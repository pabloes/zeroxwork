import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs, { writeFileSync } from 'fs';
import path from 'path';
import { prisma } from "../db";
import NodeClam from 'clamscan';
import {authenticateApiKey, verifyToken} from "../middleware/authMiddleware"; // Import NodeClam
import rateLimit from 'express-rate-limit';
import crypto from "crypto";
import { ImageAnnotatorClient } from '@google-cloud/vision';
import {promisify} from "util";
import {Readable} from "stream";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new ImageAnnotatorClient();
const calculateMD5 = (buffer: Buffer): string => {
    return crypto.createHash('md5').update(buffer).digest('hex');
};

const clamscan = await (new NodeClam().init({
    removeInfected:true,
    clamscan: {
        path:process.env.CLAMSCAN_BINARY, // Path to clamscan binary on your server
        db: null, // Path to a custom virus definition database
        scanArchives: true, // If true, scan archives (ex. zip, rar, tar, dmg, iso, etc...)
        active: true // If true, this module will consider using the clamscan binary
    },
    clamdscan: {
        socket: process.env.CLAM_AV_SOCKET_FILE||false, // Socket file for connecting via TCP
        host: process.env.CLAM_AV_HOST || false,
        port: process.env.CLAM_AV_PORT || false,
        timeout: 60000,
        localFallback: true, // Use local preferred binary to scan if socket/tcp fails
        path: process.env.CLAMDSCAN_BINARY, // Path to the clamdscan binary on your server
    }
} as NodeClam.Options));

const router = Router();
const uploadLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many uploads from this IP, please try again later.',
});

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Configure ClamAV scanner
const uploadHttpHandler =  async (req: Request, res: Response) => {

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }


    try {
        const userId = parseInt(req.user.id); // Asumiendo que `req.user` tiene la información del usuario autenticado
        const fileStream = new Readable();
        fileStream.push(req.file.buffer);
        fileStream.push(null);  // Signifies end of stream
        const {isInfected, file, viruses} = await clamscan.scanStream(fileStream);
        if (isInfected) {
            console.log('File is infected:', viruses);
            return res.status(400).json({ message: 'File is infected', viruses });
        }
        const [result] = await client.safeSearchDetection(req.file.buffer);
        console.log("detected")
        const detections = result.safeSearchAnnotation;

        console.log('Safe search result:');
        console.log(`Adult: ${detections.adult}`);
        console.log(`Medical: ${detections.medical}`);
        console.log(`Spoof: ${detections.spoof}`);
        console.log(`Violence: ${detections.violence}`);
        console.log(`Racy: ${detections.racy}`);

        // Calculate file hash (for unique identification)
        const sha256Hash: string = calculateSHA256(req.file.buffer);
        const filePageUrl = `/user-uploaded-images/${sha256Hash}`;
        // Save file to disk if it passes the virus scan

        const splittedFileName = req.file.originalname.split(".")
        const fileName = `${sha256Hash}.${splittedFileName[splittedFileName.length-1]}`;
        const publicFolder = path.join(__dirname, '../../public/user-uploaded-images');
        const publicFilePath = path.join(publicFolder, fileName);

        ensureDirectoryExistence(publicFilePath);
        writeFileSync(publicFilePath, req.file.buffer);
        if ( mustBan(detections) ) {
            const bannedFolder = path.join(__dirname, '../../public/banned-images');
            const bannedFilePath =  path.join(bannedFolder, fileName);
            ensureDirectoryExistence(bannedFilePath);
            //move from public to banned
            await promisify(fs.rename)(publicFilePath, bannedFilePath);
            console.log(`Image ${sha256Hash} marked as banned due to inappropriate content.\n Moved from:${publicFilePath}\nto:${bannedFilePath}`);
        }
        // Store file info in the database
        const fileUpload = await prisma.fileUpload.create({
            data: {
                userId,
                fileName,
                fileSize: req.file.size,
                md5Hash: calculateMD5(req.file.buffer),
                sha256Hash,
                status: 'completed'
            }
        });

        res.status(200).json({
            message: 'File uploaded successfully and passed scan',
            sha256: sha256Hash,
            filePageUrl,
            fileUrl: `/user-uploaded-images/${req.file.originalname}`
        });

        function mustBan(detections){
            return detections.adult === 'LIKELY' || detections.adult === 'VERY_LIKELY' ||
                detections.violence === 'LIKELY' || detections.violence === 'VERY_LIKELY' ||
                detections.racy === 'LIKELY' || detections.racy === 'VERY_LIKELY';
        }
    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({ message: 'Error uploading file', error: error.message });

    }
}

router.post('/upload',verifyToken, uploadLimiter, upload.single('image'),uploadHttpHandler);
router.post('/upload-api', authenticateApiKey, uploadLimiter, upload.single('image'), uploadHttpHandler);

router.delete('/:id', verifyToken, async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = parseInt(req.user.id); // Asumiendo que `req.user` tiene la información del usuario autenticado

    try {
        // Verificar que el archivo existe y pertenece al usuario
        const file = await prisma.fileUpload.findUnique({
            where: { id: parseInt(id) },
        });

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        if (file.userId !== userId) {
            return res.status(403).json({ message: 'You are not authorized to delete this file' });
        }

        // Eliminar archivo de la base de datos
        await prisma.fileUpload.delete({
            where: { id: parseInt(id) },
        });

        // Eliminar archivo físico del sistema (si es necesario)
        const filePath = path.join(__dirname, '../../public/user-uploaded-images', file.fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting file', error: error.message });
    }
});



router.get('/get-all', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.user.id); // Asumiendo que `req.user` tiene la información del usuario autenticado

        const images = await prisma.fileUpload.findMany({
            where: { userId },
            select: {
                id: true,
                fileName: true,
                sha256Hash: true,
                uploadDate: true,
                dangerous: true
            }
        });

        const imageList = images.map(image => ({
            ...image,
            id: image.id,
            fileName: image.fileName,
            fileUrl: `${req.protocol}://${req.get('host')}/api/images/user-uploaded-images/${image.fileName}`, // URL completa
            uploadDate: image.uploadDate,
            dangerous: image.dangerous
        }));

        res.json(imageList);
    } catch (error) {

        res.status(500).json({ message: 'Failed to load images.' });

    }
});

router.get('/file-status/:sha256', async (req: Request, res: Response) => {
    const { sha256 } = req.params;

    try {
        // Buscar archivo en la base de datos por sha256
        const file = await prisma.fileUpload.findUnique({
            where: { sha256Hash: sha256 }
        });

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Verificar estado del análisis
        let analysisStatus = file.status;

        // Respuesta con información del archivo y estado de análisis
        res.status(200).json({
            sha256,
            ...file,
            status: analysisStatus
        });


    } catch (error) {
        res.status(500).json({ message: 'Error fetching file status', error: error.message });
    }
});
// Utility function to calculate SHA256 hash
function calculateSHA256(buffer: Buffer): string {

    return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Ensure directory exists before saving the file
function ensureDirectoryExistence(filePath: string): void {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }
}

export default router;

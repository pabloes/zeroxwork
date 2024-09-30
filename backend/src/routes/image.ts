import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs, { writeFileSync } from 'fs';
import path from 'path';
import axios, { AxiosRequestConfig } from 'axios';
import { fileTypeFromBuffer } from 'file-type';
import { authenticateApiKey, verifyToken } from '../middleware/authMiddleware';
import rateLimit from 'express-rate-limit';
import { sanitizeFileName } from "../services/sanitize";
import { scanFileWithVirusTotal } from "../services/virustotal";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();
import * as crypto from "crypto";
import { prisma } from "../db";
import { sleep } from "../services/sleep.ts"
import { getUserQuota } from "./user";
import { ImageAnnotatorClient } from '@google-cloud/vision';
import {promisify} from "util";

// Configure Google Cloud Vision Client
const client = new ImageAnnotatorClient();

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const calculateSHA256 = (fileBuffer: Buffer): string => {
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};
const calculateMD5 = (buffer: Buffer): string => {
    return crypto.createHash('md5').update(buffer).digest('hex');
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/)) {
            return cb(new Error('Only image files (jpg, jpeg, png, webp) are allowed!'), false);
        }
        cb(null, true);
    }
});

// Rate limiter to prevent abuse (e.g., 5 uploads per minute)
const uploadLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many uploads from this IP, please try again later.',
});

const fileAnalysis:{[sha256Hash:string]: any} = {};

// Función para asegurarse de que la ruta existe
const ensureDirectoryExistence = (filePath: string): void => {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }
};

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

router.post('/upload', verifyToken, uploadLimiter, upload.single('image'), uploadHttpHandler);
router.post('/upload-api', authenticateApiKey, uploadLimiter, upload.single('image'), uploadHttpHandler);

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
    console.log("file-status")
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
        if (file.status === 'pending') {
            // Consultar el estado del análisis desde el servicio externo (ejemplo con VirusTotal)
            try {
                const response = await axios.get(`https://www.virustotal.com/api/v3/analyses/${file.analysisId}`, {
                    headers: { 'x-apikey': process.env.VIRUS_TOTAL_KEY! }
                } as AxiosRequestConfig);

                analysisStatus = response.data.data.attributes.status;

                // Actualizar estado en la base de datos si se ha completado
                if (analysisStatus === 'completed') {
                    await prisma.fileUpload.update({
                        where: { sha256Hash: sha256 },
                        data: { status: 'completed' }
                    });
                }
            } catch (error) {
                console.error('Error checking analysis status:', error.message);
            }
        }

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

const pollAnalysisStatus = async (analysisId: string, sha256Hash:string, retries: number = 60, delay: number = 10000): Promise<any> => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
                headers: {
                    'x-apikey': process.env.VIRUS_TOTAL_KEY
                }
            } as AxiosRequestConfig);

            const status = response.data.data.attributes.status;

            if (status === 'completed') {
                const stats = response.data.data.attributes.stats;
                await prisma.fileUpload.update({
                    where: { sha256Hash: sha256Hash },
                    data: {
                        status: 'completed',
                        dangerous: !!(stats.malicious || stats.suspicious || 0)
                    }
                });
                return response.data.data;
            }

            await sleep(delay);
        } catch (error) {
            throw new Error(`Error checking analysis status: ${error.response?.data?.message || error.message}`);
        }
    }

    throw new Error('Analysis did not complete in time.');
};


export default router;

async function uploadHttpHandler (req: Request, res: Response) {
    if (!req.file) {
        return res.status(400).json({message: 'No file uploaded'});
    }
    let responseIsSent = false;
    try {
        const userId = req.user.id;
        const {usedQuota, maxQuota} = await getUserQuota(userId);

        if (((req.file.size + usedQuota) > maxQuota)) {
            return res.status(501).json({error:"Your account reached max capacity. Upgrade"});
        }

        const sha256Hash: string = calculateSHA256(req.file.buffer);
        const filePageUrl = `/user-uploaded-images/${sha256Hash}`;
        //TODO look for sha256 in database, if found return answer already
        const previousUploaded = await prisma.fileUpload.findUnique({where:{sha256Hash}});
        if(previousUploaded){
            return res.status(200).json({
                message: 'File uploaded successfully and being processed',
                sha256:sha256Hash,
                filePageUrl
            });
        }

        console.log("sha256Hash", sha256Hash)
        // Scan the uploaded file buffer with VirusTotal
        const {analysisData} = await scanFileWithVirusTotal(req.file.buffer);
        const analysisId = analysisData.id;
        const splittedFileName = req.file.originalname.split(".")
        const fileName = `${sha256Hash}.${splittedFileName[splittedFileName.length-1]}`;

        const fileUpload = await prisma.fileUpload.create({
            data: {
                userId,
                fileName,
                fileSize: req.file.size,
                md5Hash: calculateMD5(req.file.buffer),
                sha256Hash,
                analysisId,
                status: 'pending'
            }
        });
        console.log("sending response")
        res.status(200).json({
            message: 'File uploaded successfully and being processed',
            sha256:sha256Hash,
            filePageUrl,
            fileUrl:`https://zeroxwork.com/api/images/user-uploaded-images/${fileName}`
        });
        responseIsSent = true;
        console.log("waiting analysis ...")
        const resolvedAnalysisData = await pollAnalysisStatus(analysisId, sha256Hash);

        //TODO copy file to the folder
        console.log("resolvedAnalysisData",resolvedAnalysisData)
        console.log("copy file to public folder")
        const publicFolder = path.join(__dirname, '../../public/user-uploaded-images');
        const publicFilePath = path.join(publicFolder, fileName);
        ensureDirectoryExistence(publicFilePath);
        writeFileSync(publicFilePath, req.file.buffer);
        console.log("copied, detecting with google vision AI")
        const [result] = await client.safeSearchDetection(req.file.buffer);
        console.log("detected")
        const detections = result.safeSearchAnnotation;

        console.log('Safe search result:');
        console.log(`Adult: ${detections.adult}`);
        console.log(`Medical: ${detections.medical}`);
        console.log(`Spoof: ${detections.spoof}`);
        console.log(`Violence: ${detections.violence}`);
        console.log(`Racy: ${detections.racy}`);

        // Check if the image contains inappropriate content
        if (
            detections.adult === 'LIKELY' || detections.adult === 'VERY_LIKELY' ||
            detections.violence === 'LIKELY' || detections.violence === 'VERY_LIKELY' ||
            detections.racy === 'LIKELY' || detections.racy === 'VERY_LIKELY'
        ) {
            // Update database to mark image as banned
            await prisma.fileUpload.update({
                where: { sha256Hash },
                data: { banned: true }
            });
            const bannedFolder = path.join(__dirname, '../../public/banned-images');
            const bannedFilePath =  path.join(bannedFolder, fileName);
            ensureDirectoryExistence(bannedFilePath);
            //TODO move from public to banned
            await promisify(fs.rename)(publicFilePath, bannedFilePath);
            console.log(`Image ${sha256Hash} marked as banned due to inappropriate content.\n Moved from:${publicFilePath}\nto:${bannedFilePath}`);
        }


    } catch (error) {
        console.log("error",error);
       if(!responseIsSent) res.status(500).json({message: 'Error uploading file', error: error.message});
    }
}
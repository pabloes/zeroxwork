import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs, {writeFile, writeFileSync} from 'fs';
import path from 'path';
import axios, {AxiosRequestConfig} from 'axios';
import { fileTypeFromBuffer } from 'file-type';
import { verifyToken } from '../middleware/authMiddleware';
import rateLimit from 'express-rate-limit';
import {sanitizeFileName} from "../services/sanitize";
import {scanFileWithVirusTotal} from "../services/virustotal";
import {fileURLToPath} from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();
import * as crypto from "crypto";
import {prisma} from "../db";

// Configure multer for in-memory storage to validate and scan files
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
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Only image files (jpg, jpeg, png) are allowed!'), false);
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

// Endpoint for image uploads with VirusTotal scanning
router.post('/upload', verifyToken, uploadLimiter, upload.single('image'), async (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({message: 'No file uploaded'});
    }

    try {
        const {userId} = req.user;
        const sha256Hash: string = calculateSHA256(req.file.buffer);
        console.log("sha256Hash", sha256Hash)
        // Scan the uploaded file buffer with VirusTotal
        const {analysisData} = await scanFileWithVirusTotal(req.file.buffer);
        const analysisId = analysisData.id;
        const tempFolder = path.join(__dirname, '../../public/temp-user-uploaded-images', userId.toString());
        const fileName = `${sha256Hash}.${req.file.originalname.split(".")[1]}`;
        const tempFilePath = path.join(tempFolder, fileName);
        ensureDirectoryExistence(tempFilePath);
        writeFileSync(tempFilePath, req.file.buffer);

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
        const filePageUrl = `/user-uploaded-images/${sha256Hash}`;
        res.status(200).json({
            message: 'File uploaded successfully and being processed',
            filePageUrl
        });
    } catch (error) {
        res.status(500).json({message: 'Error uploading file', error: error.message});
    }
});

const pollAnalysisStatus = async (analysisId: string, retries: number = 60, delay: number = 1000): Promise<any> => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
                headers: {
                    'x-apikey': process.env.VIRUS_TOTAL_KEY
                }
            } as AxiosRequestConfig);

/*            const response2 = await axios.get(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
                headers: {
                    'x-apikey': process.env.VIRUS_TOTAL_KEY
                }
            } as AxiosRequestConfig);*/

            const status = response.data.data.attributes.status;

            if (status === 'completed') {
                return response.data.data;
            }

            // Wait for a second before polling again
            await new Promise((resolve) => setTimeout(resolve, delay));
        } catch (error) {
            throw new Error(`Error checking analysis status: ${error.response?.data?.message || error.message}`);
        }
    }

    throw new Error('Analysis did not complete in time.');
};

export default router;

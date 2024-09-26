import { Router, Request, Response } from 'express';
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
import {sleep} from "../services/sleep.ts"

router.get('/quota', verifyToken, async (req: Request, res: Response) => {
    try {
        res.json(await getUserQuota(req.user.id));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching quota information', error: error.message });
    }
});

export async function getUserQuota(userId){
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            maxQuota: true,
            extraQuota: true,
            fileUploads: {
                select: {
                    fileSize: true
                }
            }
        }
    });

    // Calculate total used quota if needed
    const totalUsedQuota = user.fileUploads.reduce((sum, file) => sum + file.fileSize, 0);

    return {
        ...user,
        usedQuota: totalUsedQuota,

    }
}

export default router;
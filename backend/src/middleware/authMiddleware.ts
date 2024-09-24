import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {prisma} from "../db";

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization']?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No token provided' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
        req.user = {verified, id:verified.userId}; // Assuming user information is stored in the token
        if((verified.exp *1000) < Date.now()){
            throw new jwt.TokenExpiredError("Session expired", verified.iat);
        }
        next();
    } catch (error) {
        res.status(401).json(error);
    }
};

export async function authenticateApiKey(req, res, next) {
    const apiKey = req.header('X-API-Key'); // Leer API Key del header

    if (!apiKey) {
        return res.status(401).json({ message: 'API Key is missing.' });
    }

    try {
        const apiKeyRecord = await prisma.apiKey.findUnique({
            where: { key: apiKey },
            include: { user: true }, // Incluir el usuario relacionado
        });

        if (!apiKeyRecord) {
            return res.status(401).json({ message: 'API Key no válida.' });
        }

        // Actualizar el campo lastUsedAt
        await prisma.apiKey.update({
            where: { id: apiKeyRecord.id },
            data: { lastUsedAt: new Date() },
        });

        // Adjuntar el usuario a la solicitud para su uso posterior
        req.user = apiKeyRecord.user;

        next();
    } catch (error) {
        console.error('Error autenticando la API Key:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
}
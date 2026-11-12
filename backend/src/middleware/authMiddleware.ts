import { Request, Response, NextFunction } from 'express';
import {prisma} from "../db";
import { resolveSession } from './session';

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization']?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No token provided' });
    }

    try {
        // Not every token signed by us is a session: the links we mail are not,
        // and a session dies with the password it was opened with.
        const user = await resolveSession(token);
        if (!user) {
            return res.status(401).json({ message: 'Session expired or not valid. Please sign in again.' });
        }

        req.user = user;
        next();
    } catch (error) {
        // Only the database can throw here. That is our problem, not a bad
        // session, and answering 401 would sign the person out for it.
        console.error('Session check failed: the account could not be read');
        res.status(503).json({ message: 'The session could not be checked right now. Please try again.' });
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
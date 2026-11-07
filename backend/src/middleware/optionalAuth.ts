/**
 * Reads the caller's token when there is one and lets the request through
 * either way, so a route can serve the public and still recognise an author.
 *
 * verifyToken answers 401 and stops; this one never does. Used by the article
 * read routes, which are public for published articles and have to show an
 * unpublished draft to the person writing it.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/index.js';
import { env } from '../config/env.js';

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return next();

    try {
        const verified = jwt.verify(token, env.JWT_SECRET) as any;
        if ((verified.exp * 1000) < Date.now()) return next();

        // Read the role from the database rather than the token, same as
        // verifyToken: a token minted before a demotion must not still be admin.
        const user = await prisma.user.findUnique({
            where: { id: verified.userId },
            select: { id: true, email: true, role: true },
        });
        if (user) (req as any).user = user;
    } catch {
        // An expired or forged token is simply not a reader we know. The route
        // decides what an anonymous caller may see.
    }

    next();
};

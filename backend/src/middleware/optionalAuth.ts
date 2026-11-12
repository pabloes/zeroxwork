/**
 * Reads the caller's token when there is one and lets the request through
 * either way, so a route can serve the public and still recognise an author.
 *
 * verifyToken answers 401 and stops; this one never does. Used by the article
 * read routes, which are public for published articles and have to show an
 * unpublished draft to the person writing it.
 */

import { Request, Response, NextFunction } from 'express';
import { resolveSession } from './session.js';

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return next();

    try {
        // Same rules as verifyToken, including reading the role from the
        // database: a token minted before a demotion must not still be admin.
        const user = await resolveSession(token);
        if (user) (req as any).user = user;
    } catch {
        // An expired or forged token is simply not a reader we know. The route
        // decides what an anonymous caller may see.
    }

    next();
};

/**
 * Who is behind a Bearer token, for both auth middlewares.
 *
 * A token is a live session when it was signed as one, the account still
 * exists, and the password has not changed since it was issued. The role and
 * the email always come from the database, never from the token: one minted
 * before a demotion must not still be admin.
 */
import { prisma } from '../db/index.js';
import { env } from '../config/env.js';
import { readSession, sessionStillValid } from '../services/auth-tokens.js';

export interface SessionUser {
    id: number;
    email: string;
    role: string;
}

export async function resolveSession(token: string): Promise<SessionUser | null> {
    let claims;
    try {
        claims = readSession(token, env.JWT_SECRET);
    } catch {
        return null;
    }

    const user = await prisma.user.findUnique({
        where: { id: claims.userId },
        select: { id: true, email: true, role: true, password: true },
    });
    if (!user) return null;
    if (!sessionStillValid(claims, user.password, env.JWT_SECRET)) return null;

    // The hash was only needed for the check above; it stops here.
    return { id: user.id, email: user.email, role: user.role };
}

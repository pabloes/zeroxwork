import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

/**
 * Allows all requests that don't include a "script" payload.
 * If "script" is present and truthy, the user must be ADMIN.
 * Fetches role from database only when script is present.
 */
export async function requireAdminIfScript(req: Request, res: Response, next: NextFunction) {
  const hasScript =
    typeof (req.body?.script) === 'string' && req.body.script.trim().length > 0 ||
    typeof (req.body?.article?.script) === 'string' && req.body.article.script.trim().length > 0;

  if (!hasScript) {
    return next();
  }

  // Only query the database if script is present
  try {
    const userId = (req as any)?.user?.id || (req as any)?.user?.userId;

    if (!userId) {
      return res.status(403).json({ error: 'User not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user.role === 'ADMIN') {
      return next();
    }

    return res.status(403).json({ error: 'Admin privileges required to include article script' });
  } catch (error) {
    console.error('Error checking admin privileges:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default requireAdminIfScript;

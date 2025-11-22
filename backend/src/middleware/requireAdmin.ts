import { Request, Response, NextFunction } from 'express';
import { ROLE } from '../constants/roles';

/**
 * Ensures the current user has ADMIN role.
 * Looks for role on req.user, res.locals.user, or req.session.user (depending on your auth wiring).
 * Responds with 403 if not ADMIN.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const role =
      (req as any)?.user?.role ??
      (res.locals as any)?.user?.role ??
      (req as any)?.session?.user?.role;

    if (role === ROLE.ADMIN) {
      return next();
    }
    return res.status(403).json({ error: 'Admin privileges required' });
  } catch {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
}

export default requireAdmin;

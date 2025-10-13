import { Request, Response, NextFunction } from 'express';

/**
 * Allows all requests that don't include a "script" payload.
 * If "script" is present and truthy, the user must be ADMIN.
 * Looks for role on req.user, res.locals.user, or req.session.user.
 */
export function requireAdminIfScript(req: Request, res: Response, next: NextFunction) {
  const hasScript =
    typeof (req.body?.script) === 'string' && req.body.script.trim().length > 0 ||
    typeof (req.body?.article?.script) === 'string' && req.body.article.script.trim().length > 0;

  if (!hasScript) {
    return next();
  }

  const role =
    (req as any)?.user?.role ??
    (res.locals as any)?.user?.role ??
    (req as any)?.session?.user?.role;

  if (role === 'ADMIN') {
    return next();
  }

  return res.status(403).json({ error: 'Admin privileges required to include article script' });
}

export default requireAdminIfScript;

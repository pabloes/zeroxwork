import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/requireAdmin';
import { clear, query, stats, LogLevel } from '../services/log-store';
import { getSmtpConfigSummary, verifySmtp } from '../services/mailer';
import { prisma } from '../db';

const router = Router();

const logsLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 60,
    message: { message: 'Too many log requests. Try again later.' },
});

function sameSecret(a: string, b: string): boolean {
    const hashA = crypto.createHash('sha256').update(a).digest();
    const hashB = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Two ways in:
 *  - `X-Logs-Token` header matching the LOGS_TOKEN env var (for curl / scripts)
 *  - a normal admin JWT in `Authorization: Bearer <token>`
 * If LOGS_TOKEN is not set, only the admin JWT works.
 */
function requireLogsAccess(req: Request, res: Response, next: NextFunction) {
    const provided = req.header('X-Logs-Token');
    const expected = process.env.LOGS_TOKEN;

    if (expected && provided && sameSecret(provided, expected)) {
        return next();
    }

    return verifyToken(req, res, () => requireAdmin(req, res, next));
}

router.use(logsLimiter, requireLogsAccess);

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

function parseQuery(req: Request) {
    const level = typeof req.query.level === 'string' && LEVELS.includes(req.query.level as LogLevel)
        ? (req.query.level as LogLevel)
        : undefined;

    return {
        level,
        scope: typeof req.query.scope === 'string' ? req.query.scope : undefined,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        since: typeof req.query.since === 'string' ? req.query.since : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
}

/**
 * GET /api/logs?level=error&scope=mail&q=texto&since=ISO&limit=200
 * Most recent entries last.
 */
router.get('/', (req: Request, res: Response) => {
    res.json(query(parseQuery(req)));
});

/** GET /api/logs/text — same filters, plain text so it reads well in a terminal. */
router.get('/text', (req: Request, res: Response) => {
    const result = query(parseQuery(req));
    const lines = result.entries.map((entry) => {
        const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
        return `${entry.ts} [${entry.level.toUpperCase()}] (${entry.scope}) ${entry.message}${meta}`;
    });

    res.type('text/plain').send(
        [
            `# buffer desde ${result.startedAt} — ${result.total} coincidencias, ${result.dropped} descartadas`,
            ...lines,
        ].join('\n')
    );
});

/** GET /api/logs/stats — buffer size and counts by level/scope. */
router.get('/stats', (_req: Request, res: Response) => {
    res.json(stats());
});

/**
 * GET /api/logs/diagnostics?verify=false
 * Health of the pieces that silently break sign-up: env vars, SMTP, database.
 */
router.get('/diagnostics', async (req: Request, res: Response) => {
    const envPresence = Object.fromEntries(
        [
            'DATABASE_URL',
            'JWT_SECRET',
            'SESSION_SECRET',
            'ADMIN_COOKIE_PASSWORD',
            'VERIFICATION_RESEND_SECRET',
            'SMTP_HOST',
            'SMTP_PORT',
            'SMTP_SECURE',
            'SMTP_USER',
            'SMTP_PASS',
            'LOGS_TOKEN',
        ].map((name) => [name, Boolean(process.env[name]?.trim())])
    );

    let database: { ok: boolean; error?: string; users?: number; unverified?: number } = { ok: false };
    try {
        const [users, unverified] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { verified: false } }),
        ]);
        database = { ok: true, users, unverified };
    } catch (error: any) {
        database = { ok: false, error: error?.message ?? String(error) };
    }

    const smtp = {
        config: getSmtpConfigSummary(),
        verify: req.query.verify === 'false' ? { skipped: true } : await verifySmtp(),
    };

    res.json({
        now: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV || null,
        uptimeSeconds: Math.round(process.uptime()),
        env: envPresence,
        smtp,
        database,
        logBuffer: stats(),
    });
});

/**
 * GET /api/logs/registrations?limit=10
 * Last accounts created, to tell "the user was never created" apart from
 * "the user exists but the verification mail never went out".
 */
router.get('/registrations', async (req: Request, res: Response) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);

    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: { id: true, email: true, verified: true, createdAt: true, role: true },
        });
        res.json({ count: users.length, users });
    } catch (error: any) {
        res.status(500).json({ message: 'Could not read registrations', error: error?.message });
    }
});

/** DELETE /api/logs — empties the in-memory buffer (nothing persisted is touched). */
router.delete('/', (_req: Request, res: Response) => {
    res.json({ cleared: clear() });
});

export default router;

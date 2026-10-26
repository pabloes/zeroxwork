import { Request, Response, NextFunction } from 'express';
import { record } from '../services/log-store';

// Static assets and the log endpoints themselves would just flood the buffer.
const SKIP_PATH = /\.(js|mjs|css|map|png|jpe?g|svg|gif|webp|avif|ico|woff2?|ttf|eot|txt|json)$/i;

/**
 * Records one entry per HTTP request (method, path, status, duration, ip).
 * Query strings are dropped on purpose: verification links carry tokens.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
    // originalUrl, captured now: Express rewrites req.url/req.path once the
    // request enters a mounted router, and `finish` fires after that.
    const path = req.originalUrl.split('?')[0];

    if (SKIP_PATH.test(path) || path.startsWith('/api/logs')) {
        return next();
    }

    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        record(level, 'http', `${req.method} ${path} ${res.statusCode} ${durationMs.toFixed(1)}ms`, {
            method: req.method,
            path,
            status: res.statusCode,
            durationMs: Number(durationMs.toFixed(1)),
            ip: req.ip,
            host: req.hostname,
            userAgent: req.get('user-agent'),
            userId: (req as any)?.user?.id,
        });
    });

    next();
}

export default requestLogger;

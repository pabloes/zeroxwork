import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

/**
 * GET /api/speedtest/ping
 * Returns a minimal response for latency measurement.
 */
router.get('/ping', (_req: Request, res: Response) => {
    res.json({ t: Date.now() });
});

/**
 * GET /api/speedtest/download?size=<bytes>
 * Streams random data for download speed measurement.
 * Size capped at 25 MB.
 */
router.get('/download', (req: Request, res: Response) => {
    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
    const size = Math.min(Number(req.query.size) || 1024 * 1024, MAX_SIZE);

    res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(size),
        'Cache-Control': 'no-store',
    });

    const CHUNK = 64 * 1024;
    let remaining = size;

    function sendChunk() {
        while (remaining > 0) {
            const len = Math.min(CHUNK, remaining);
            const buf = crypto.randomBytes(len);
            remaining -= len;
            if (!res.write(buf)) {
                res.once('drain', sendChunk);
                return;
            }
        }
        res.end();
    }

    sendChunk();
});

/**
 * POST /api/speedtest/upload
 * Consumes raw body for upload speed measurement.
 * Body limit handled by express raw parser below.
 */
router.post('/upload', (req: Request, res: Response) => {
    let bytes = 0;
    req.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
    });
    req.on('end', () => {
        res.json({ bytes });
    });
});

export default router;

import util from 'util';

/**
 * In-memory ring buffer of site logs, exposed through /api/logs for auditing.
 *
 * Why in-memory: the container writes everything to stdout (docker logs) and
 * nothing is persisted, so there was no way to inspect what happened without
 * SSH access to the server. This keeps the last N entries available over HTTP.
 *
 * Caveats:
 *  - the buffer is lost on restart/redeploy (it only covers the current process)
 *  - CapRover may run more than one replica; each one has its own buffer
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    id: number;
    ts: string;
    level: LogLevel;
    scope: string;
    message: string;
    meta?: Record<string, unknown>;
}

const MAX_ENTRIES = Math.min(
    Math.max(parseInt(process.env.LOG_BUFFER_SIZE || '2000', 10) || 2000, 100),
    20000
);
const MAX_MESSAGE_LENGTH = 4000;

const entries: LogEntry[] = [];
let nextId = 1;
let dropped = 0;
const startedAt = new Date().toISOString();

// Captured before console is patched, so logging from here never recurses.
const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
};

const REDACTIONS: Array<[RegExp, string]> = [
    // JWTs (verification tokens, auth tokens)
    [/\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g, '[JWT_REDACTED]'],
    [/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]'],
    // key=value / "key": "value" pairs that carry secrets
    [
        /((?:password|passwd|pass|secret|token|api[_-]?key|authorization|cookie)["']?\s*[:=]\s*["']?)([^\s"',;}&]+)/gi,
        '$1[REDACTED]',
    ],
];

/** Strips credentials and tokens out of anything we are about to store. */
export function redact(text: string): string {
    let out = text;
    for (const [pattern, replacement] of REDACTIONS) {
        out = out.replace(pattern, replacement);
    }
    return out;
}

function formatArgs(args: unknown[]): string {
    return args
        .map((arg) => {
            if (arg instanceof Error) {
                return `${arg.name}: ${arg.message}\n${arg.stack ?? ''}`;
            }
            return typeof arg === 'string' ? arg : util.inspect(arg, { depth: 4, breakLength: 120 });
        })
        .join(' ');
}

/** Appends an entry to the buffer. Never throws: logging must not break a request. */
export function record(
    level: LogLevel,
    scope: string,
    message: string,
    meta?: Record<string, unknown>
): void {
    try {
        let safeMessage = redact(message);
        if (safeMessage.length > MAX_MESSAGE_LENGTH) {
            safeMessage = `${safeMessage.slice(0, MAX_MESSAGE_LENGTH)}… [truncated]`;
        }

        let safeMeta: Record<string, unknown> | undefined;
        if (meta) {
            safeMeta = JSON.parse(redact(JSON.stringify(meta)));
        }

        entries.push({
            id: nextId++,
            ts: new Date().toISOString(),
            level,
            scope,
            message: safeMessage,
            meta: safeMeta,
        });

        while (entries.length > MAX_ENTRIES) {
            entries.shift();
            dropped++;
        }
    } catch (error) {
        originalConsole.error('LOG_STORE_ failed to record entry:', error);
    }
}

/**
 * Patches console.* so everything the app already logs also lands in the buffer.
 * Keeps writing to stdout/stderr (and keeps the existing "LOG_" prefix on log()).
 */
export function installConsoleCapture(): void {
    const capture = (level: LogLevel, original: (...args: any[]) => void, prefix?: string) => {
        return (...args: any[]) => {
            if (prefix) {
                original(prefix, ...args);
            } else {
                original(...args);
            }
            record(level, 'console', formatArgs(args));
        };
    };

    console.log = capture('info', originalConsole.log, 'LOG_');
    console.info = capture('info', originalConsole.info);
    console.warn = capture('warn', originalConsole.warn);
    console.error = capture('error', originalConsole.error);
    console.debug = capture('debug', originalConsole.debug);
}

export interface LogQuery {
    level?: LogLevel;
    scope?: string;
    q?: string;
    since?: string;
    limit?: number;
}

export function query(options: LogQuery = {}): { total: number; dropped: number; startedAt: string; entries: LogEntry[] } {
    const limit = Math.min(Math.max(options.limit ?? 200, 1), MAX_ENTRIES);
    const sinceTs = options.since ? Date.parse(options.since) : NaN;
    const needle = options.q?.toLowerCase();

    const matched = entries.filter((entry) => {
        if (options.level && entry.level !== options.level) return false;
        if (options.scope && entry.scope !== options.scope) return false;
        if (!Number.isNaN(sinceTs) && Date.parse(entry.ts) < sinceTs) return false;
        if (needle) {
            const haystack = `${entry.scope} ${entry.message} ${entry.meta ? JSON.stringify(entry.meta) : ''}`.toLowerCase();
            if (!haystack.includes(needle)) return false;
        }
        return true;
    });

    return {
        total: matched.length,
        dropped,
        startedAt,
        entries: matched.slice(-limit),
    };
}

export function stats() {
    const byLevel: Record<string, number> = {};
    const byScope: Record<string, number> = {};
    for (const entry of entries) {
        byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
        byScope[entry.scope] = (byScope[entry.scope] || 0) + 1;
    }
    return {
        startedAt,
        buffered: entries.length,
        capacity: MAX_ENTRIES,
        dropped,
        byLevel,
        byScope,
    };
}

export function clear(): number {
    const removed = entries.length;
    entries.length = 0;
    dropped = 0;
    return removed;
}

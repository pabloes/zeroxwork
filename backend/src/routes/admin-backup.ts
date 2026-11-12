/**
 * Descargar una copia de seguridad de la base de datos desde /admin.
 *
 * Existe porque la copia hay que hacerla ANTES de tocar nada, y hasta ahora
 * eso significaba entrar por SSH al servidor y acordarse de la sintaxis de
 * `pg_dump`. Una copia que cuesta quince minutos y una conexion SSH es una
 * copia que no se hace.
 *
 * Qui se puede descargar: solo quien tiene sesion abierta en /admin Y sigue
 * siendo ADMIN en la base de datos ahora mismo. La cookie dice quien entro;
 * el rol se vuelve a mirar en cada descarga, porque una sesion abierta hace
 * meses no es permiso para llevarse la base entera.
 *
 * Lo que sale es el volcado completo: correos y hashes de contrasena incluidos.
 * No es un fichero para dejar en Descargas ni para subir a ningun sitio.
 */

import { spawn } from 'child_process';
import express, { Request, Response } from 'express';
import { createGzip } from 'zlib';
import { prisma } from '../db';
import { ROLE } from '../constants/roles';

const router = express.Router();

/** Nombre del fichero: la fecha en local, que es como se buscan las copias. */
function backupName(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `zeroxwork-${stamp}.sql.gz`;
}

/**
 * La contrasena va por el entorno, no en los argumentos: lo que se pasa en la
 * linea de ordenes lo ve cualquiera que haga `ps` dentro del contenedor.
 */
function dumpCommand(databaseUrl: string): { args: string[]; env: NodeJS.ProcessEnv } {
    const url = new URL(databaseUrl);
    const args = [
        '--host', url.hostname,
        '--port', url.port || '5432',
        '--username', decodeURIComponent(url.username),
        '--dbname', url.pathname.replace(/^\//, ''),
        '--no-owner',
        '--no-privileges',
    ];
    return { args, env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) } };
}

/** Que version de PostgreSQL hay al otro lado, para poder contarlo al fallar. */
async function serverVersion(): Promise<string> {
    try {
        const rows = await prisma.$queryRawUnsafe<{ server_version: string }[]>('SHOW server_version');
        return `El servidor es PostgreSQL ${rows[0]?.server_version ?? '(desconocido)'}.`;
    } catch {
        return 'No se ha podido preguntar la version del servidor.';
    }
}

/** La sesion de AdminJS dice quien es; la base de datos dice si aun lo es. */
async function requireAdmin(req: Request, res: Response): Promise<{ id: number; email: string } | null> {
    const sessionUser = (req as any).session?.adminUser;
    if (!sessionUser || typeof sessionUser !== 'object' || !sessionUser.id) {
        res.status(401).type('text/plain').send('Entra en /admin primero.');
        return null;
    }

    const user = await prisma.user.findUnique({
        where: { id: Number(sessionUser.id) },
        select: { id: true, email: true, role: true },
    });

    if (!user || user.role !== ROLE.ADMIN) {
        res.status(403).type('text/plain').send('Solo un administrador puede descargar la copia.');
        return null;
    }

    return { id: user.id, email: user.email };
}

router.get('/backup.sql.gz', async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        return res.status(500).type('text/plain').send('No hay DATABASE_URL en el entorno.');
    }

    const { args, env } = dumpCommand(databaseUrl);
    const child = spawn('pg_dump', args, { env });

    // pg_dump escribe sus quejas en stderr y luego sale con codigo != 0. Se
    // guardan para poder contarlas, porque "ha fallado la descarga" no dice
    // nada y el motivo casi siempre es exacto: no esta instalado, o la version
    // del servidor es mas nueva que la del cliente.
    let complaints = '';
    child.stderr.on('data', (chunk) => { complaints += String(chunk); });

    // Las cabeceras no se envian hasta que hay datos de verdad. Mandarlas antes
    // seria prometer un fichero que todavia puede no existir, y el navegador
    // guardaria el error como si fuera la copia.
    let started = false;
    // Un pg_dump que no arranca avisa dos veces, por 'error' y por 'close'.
    // La primera es la que sabe por que, y la respuesta ya solo se manda una.
    let settled = false;
    const gzip = createGzip();

    const fail = (status: number, message: string) => {
        if (settled) return;
        settled = true;

        if (started) {
            // Ya iba el fichero: no hay forma honrada de retractarse, asi que
            // se corta la conexion y el navegador marca la descarga como rota.
            console.error('LOG_ backup: fallo a mitad del volcado:', message);
            res.destroy();
            return;
        }
        console.error('LOG_ backup: no se ha podido volcar:', message);
        res.status(status).type('text/plain').send(message);
    };

    child.on('error', (error: NodeJS.ErrnoException) => {
        fail(500, error.code === 'ENOENT'
            ? 'pg_dump no esta instalado en este contenedor.'
            : `No se ha podido ejecutar pg_dump: ${error.message}`);
    });

    child.stdout.once('data', () => {
        started = true;
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename="${backupName()}"`);
        res.setHeader('Cache-Control', 'no-store');
        console.log(`LOG_ backup: copia descargada por ${admin.email} (id=${admin.id})`);
    });

    child.on('close', async (code) => {
        if (code === 0 || settled) return;
        const why = complaints.trim() || `pg_dump ha terminado con el codigo ${code}.`;
        // El fallo mas probable es de versiones, y la queja de pg_dump nombra
        // la suya pero no siempre la del servidor. Con las dos al lado, la
        // linea de apk que hay que cambiar en el Dockerfile se deduce sola.
        fail(500, `${why}\n\n${await serverVersion()}`);
    });

    child.stdout.pipe(gzip).pipe(res);

    // Si quien descarga cierra la pestana a medias, el volcado deja de servir
    // para nada y seguiria ocupando una conexion a la base de datos.
    res.on('close', () => {
        if (!child.killed && child.exitCode === null) child.kill();
    });
});

export default router;

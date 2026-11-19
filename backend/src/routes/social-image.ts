/**
 * La imagen de una pieza en jpg, para quien dibuja la previsualizacion de un
 * enlace.
 *
 * Lo que se sube a la web se guarda en webp, que pesa la mitad y es lo que
 * tiene que llegarle a quien abre la pagina. Pero una tarjeta de enlace no la
 * dibuja un navegador: la dibuja X, y X no pinta un webp. Su documentacion
 * dice que lo acepta, y la prueba dice que no -- el enlace sale con el titulo,
 * el resumen y un hueco gris donde iba el cartel. Con el logo, que es png,
 * salia la imagen grande; con el cartel del articulo, que es webp, no salia
 * ninguna. Asi que aqui se convierte, y solo para esto: la pagina sigue
 * sirviendo su webp a todo el mundo.
 *
 * Se convierte al vuelo y se guarda en memoria. Un fichero nuevo se pide una
 * vez por previsualizador y nunca mas -- cada uno se queda con su copia -- asi
 * que no hay nada que escribir en disco, que ademas en produccion es un
 * volumen montado y seria una carpeta mas que cuidar.
 */

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Donde estan las subidas, el mismo sitio que mira el router de imagenes. */
const UPLOADS = path.join(here, '../../public/user-uploaded-images');

/**
 * X pide como mucho 4096 y recomienda cerca de 1200 de ancho; mas que eso solo
 * es tiempo de descarga para una imagen que se va a ver en una tarjeta. Una
 * mas pequena se deja como esta, que agrandarla no anade nada.
 */
const MAX_WIDTH = 1600;

/** Lo justo para que un cartel no se vea sucio sin irse a megabytes. */
const QUALITY = 82;

/** Un nombre de subida: letras, numeros y poco mas. Ni barras ni dos puntos. */
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

/**
 * Las ultimas convertidas. Son pocas -- las piezas que se estan compartiendo
 * estos dias -- y el nombre de cada fichero es el hash de su contenido, asi
 * que una copia nunca se queda vieja: si la imagen cambia, cambia el nombre.
 */
const CACHE_MAX = 32;
const cache = new Map<string, Buffer>();

function remember(key: string, jpeg: Buffer) {
    cache.set(key, jpeg);
    while (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next().value as string;
        cache.delete(oldest);
    }
}

/**
 * El router de /api/images/social. El directorio se puede cambiar para poder
 * probarlo sin tocar las subidas de verdad.
 */
export function socialImageRoutes(uploadsDir: string = UPLOADS): Router {
    const router = Router();

    router.get('/:file', async (req, res) => {
        const asked = req.params.file;

        // Lo que se pide es <el fichero de verdad>.jpg, con su extension
        // original dentro: asi se sabe de cual sale sin mirar la carpeta.
        if (!asked.endsWith('.jpg') || asked.includes('..')) return res.sendStatus(404);
        const source = asked.slice(0, -'.jpg'.length);
        if (!SAFE_NAME.test(source)) return res.sendStatus(404);

        const cached = cache.get(source);
        if (cached) return send(res, cached);

        try {
            const original = await fs.readFile(path.join(uploadsDir, source));
            const jpeg = await sharp(original)
                // Lo que trae la foto en los metadatos, antes de perderlos.
                .rotate()
                .resize({ width: MAX_WIDTH, withoutEnlargement: true })
                .flatten({ background: '#000000' })  // un png con transparencia
                .jpeg({ quality: QUALITY })
                .toBuffer();

            remember(source, jpeg);
            return send(res, jpeg);
        } catch (error: any) {
            // Un nombre que no existe, o algo que no era una imagen. Quien
            // pregunta es un rastreador: se queda sin cartel y ya esta.
            if (error?.code !== 'ENOENT') {
                console.error('LOG_ social image:', source, error?.message ?? error);
            }
            return res.sendStatus(404);
        }
    });

    return router;
}

/** El nombre del fichero lleva el hash dentro, asi que la copia no caduca. */
function send(res: any, jpeg: Buffer) {
    res.type('jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(jpeg);
}

export default socialImageRoutes;

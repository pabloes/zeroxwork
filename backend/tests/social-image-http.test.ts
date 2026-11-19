/**
 * La copia en jpg sobre HTTP de verdad, con imagenes de verdad en una carpeta
 * de usar y tirar. Lo que se comprueba es que de un webp sale un jpg, que no
 * se puede pedir nada que no sea una subida, y que lo que no se puede
 * convertir no tira la peticion abajo.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { socialImageRoutes } from '../src/routes/social-image.js';

let uploads: string;
let server: any;
let base: string;

beforeAll(async () => {
    uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'social-image-'));

    // El cartel de un articulo: webp, y mas ancho que el tope.
    const cartel = await sharp({
        create: { width: 1672, height: 941, channels: 3, background: '#c03030' },
    }).webp().toBuffer();
    await fs.writeFile(path.join(uploads, 'cartel.webp'), cartel);

    // Una subida pequena, que no hay que agrandar.
    const pequena = await sharp({
        create: { width: 400, height: 300, channels: 3, background: '#3060c0' },
    }).webp().toBuffer();
    await fs.writeFile(path.join(uploads, 'pequena.webp'), pequena);

    await fs.writeFile(path.join(uploads, 'esto-no-es-una-imagen.webp'), 'texto llano');

    const app = express();
    app.use('/api/images/social', socialImageRoutes(uploads));

    await new Promise<void>((done) => { server = app.listen(0, done); });
    base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
    await new Promise<void>((done) => server.close(() => done()));
    await fs.rm(uploads, { recursive: true, force: true });
});

const get = (url: string) => fetch(`${base}${url}`);

describe('la copia para la tarjeta', () => {
    it('de un webp devuelve un jpg', async () => {
        const res = await get('/api/images/social/cartel.webp.jpg');

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('image/jpeg');

        const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
        expect(meta.format).toBe('jpeg');
    });

    it('la deja como mucho en 1600 de ancho, sin estirar la pequena', async () => {
        const grande = await sharp(Buffer.from(await (await get('/api/images/social/cartel.webp.jpg')).arrayBuffer())).metadata();
        expect(grande.width).toBe(1600);

        const chica = await sharp(Buffer.from(await (await get('/api/images/social/pequena.webp.jpg')).arrayBuffer())).metadata();
        expect(chica.width).toBe(400);
    });

    it('el nombre lleva el hash dentro, asi que se puede guardar para siempre', async () => {
        const res = await get('/api/images/social/cartel.webp.jpg');
        expect(res.headers.get('cache-control')).toContain('immutable');
    });

    it('la segunda vez sale igual, que viene de memoria', async () => {
        const una = Buffer.from(await (await get('/api/images/social/cartel.webp.jpg')).arrayBuffer());
        const otra = Buffer.from(await (await get('/api/images/social/cartel.webp.jpg')).arrayBuffer());
        expect(otra.equals(una)).toBe(true);
    });
});

describe('lo que no se sirve', () => {
    it('un nombre que se sale de la carpeta', async () => {
        expect((await get('/api/images/social/%2e%2e%2f%2e%2e%2fsecreto.jpg')).status).toBe(404);
        expect((await get('/api/images/social/..%2Fsecreto.jpg')).status).toBe(404);
    });

    it('lo que no acaba en .jpg, que seria pedir el original por aqui', async () => {
        expect((await get('/api/images/social/cartel.webp')).status).toBe(404);
    });

    it('un fichero que no existe', async () => {
        expect((await get('/api/images/social/ni-idea.webp.jpg')).status).toBe(404);
    });

    it('algo que no era una imagen', async () => {
        expect((await get('/api/images/social/esto-no-es-una-imagen.webp.jpg')).status).toBe(404);
    });
});

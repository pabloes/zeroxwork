/**
 * Las piezas sueltas de la previsualizacion: el recorte del markdown y el
 * reemplazo sobre la plantilla. Sin servidor y sin base de datos; lo que hace
 * falta una peticion para verlo esta en social-preview-http.test.ts.
 */
import { describe, it, expect } from 'vitest';
import {
    DESCRIPTION_MAX,
    FALLBACK_IMAGE,
    injectSocialMeta,
    metaDescription,
    ogLocale,
    plainExcerpt,
    SOCIAL_IMAGE_PATH,
    socialImage,
    uploadedFileName,
} from '../src/services/page-meta.js';
import { SITE_URL } from '../src/config/site.js';

describe('el recorte del markdown', () => {
    it('se queda con el primer parrafo en texto llano', () => {
        const markdown = [
            '# ZEROxCITY Comic Contest',
            '',
            'Un concurso de **comics** con [normas](https://zeroxwork.com/normas) y premio.',
            '',
            'Esto es el segundo parrafo y no tendria que salir.',
        ].join('\n');

        expect(plainExcerpt(markdown)).toBe(
            'Un concurso de comics con normas y premio.',
        );
    });

    it('se salta el titular, que repetiria el titulo justo encima', () => {
        expect(plainExcerpt('## Como participar\n\nManda tu comic antes del 31.'))
            .toBe('Manda tu comic antes del 31.');
    });

    it('si todo el cuerpo son titulares, usa el primero antes que nada', () => {
        expect(plainExcerpt('# Solo un titular')).toBe('Solo un titular');
    });

    it('se salta la imagen de cabecera, que no dice nada', () => {
        const markdown = '![cartel](/api/images/user-uploaded-images/cartel.jpg)\n\nDibuja tu comic.';
        expect(plainExcerpt(markdown)).toBe('Dibuja tu comic.');
    });

    it('corta por un espacio y avisa de que sigue', () => {
        const long = `${'palabra '.repeat(60)}final`;
        const cut = plainExcerpt(long);

        expect(cut.length).toBeLessThanOrEqual(DESCRIPTION_MAX + 1);
        expect(cut.endsWith('…')).toBe(true);
        expect(cut).not.toMatch(/ …$/);
    });

    it('un articulo sin cuerpo no inventa una descripcion', () => {
        expect(plainExcerpt('')).toBe('');
        expect(plainExcerpt(null)).toBe('');
    });

    it('el resumen escrito a mano manda sobre el cuerpo', () => {
        expect(metaDescription('Un comic sobre el dinero.', '# Otra cosa\n\nTexto.'))
            .toBe('Un comic sobre el dinero.');
        expect(metaDescription('   ', '# Titular\n\nEl cuerpo.')).toBe('El cuerpo.');
        expect(metaDescription(null, null)).toBe('');
    });
});

describe('la imagen', () => {
    it('se escribe entera, porque un rastreador no resuelve rutas', () => {
        expect(socialImage('/api/images/user-uploaded-images/cartel.jpg'))
            .toBe(`${SITE_URL}/api/images/user-uploaded-images/cartel.jpg`);
        expect(socialImage('/api/images/user-uploaded-images/cartel.jpg')).toMatch(/^https:\/\//);
    });

    it('sin imagen propia cae en el logo', () => {
        expect(socialImage(null)).toBe(FALLBACK_IMAGE);
        expect(socialImage('')).toBe(FALLBACK_IMAGE);
        expect(FALLBACK_IMAGE).toBe(`${SITE_URL}/zeroxwork-logo.png`);
    });

    it('una imagen de otro sitio se deja como esta', () => {
        expect(socialImage('https://otra-web.com/foto.png')).toBe('https://otra-web.com/foto.png');
    });

    it('un webp nuestro sale por su copia en jpg, que es la que se dibuja', () => {
        expect(socialImage('/api/images/user-uploaded-images/cartel.webp'))
            .toBe(`${SITE_URL}${SOCIAL_IMAGE_PATH}/cartel.webp.jpg`);
        // Las filas viejas lo tienen escrito entero y son la misma imagen.
        expect(socialImage(`${SITE_URL}/api/images/user-uploaded-images/cartel.webp`))
            .toBe(`${SITE_URL}${SOCIAL_IMAGE_PATH}/cartel.webp.jpg`);
    });

    it('lo que ya se dibuja no da ninguna vuelta', () => {
        for (const name of ['cartel.jpg', 'cartel.JPEG', 'cartel.png', 'cartel.gif']) {
            expect(socialImage(`/api/images/user-uploaded-images/${name}`))
                .toBe(`${SITE_URL}/api/images/user-uploaded-images/${name}`);
        }
    });

    it('un webp de otro sitio no es nuestro para convertirlo', () => {
        expect(socialImage('https://otra-web.com/foto.webp')).toBe('https://otra-web.com/foto.webp');
    });

    it('solo una subida cuenta como nuestra', () => {
        expect(uploadedFileName('/api/images/user-uploaded-images/cartel.webp')).toBe('cartel.webp');
        expect(uploadedFileName('/zeroxwork-logo.png')).toBeNull();
        expect(uploadedFileName('https://otra-web.com/foto.webp')).toBeNull();
        expect(uploadedFileName('/api/images/user-uploaded-images/../../secreto.webp')).toBeNull();
        expect(uploadedFileName(null)).toBeNull();
    });
});

describe('el idioma', () => {
    it('se escribe como lo escribe OpenGraph', () => {
        expect(ogLocale('es')).toBe('es');
        expect(ogLocale('pt-br')).toBe('pt_BR');
        expect(ogLocale('PT-BR')).toBe('pt_BR');
    });

    it('uno que no conocemos se queda fuera antes que ir mal', () => {
        expect(ogLocale('klingon')).toBeUndefined();
        expect(ogLocale(null)).toBeUndefined();
    });
});

const TEMPLATE = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <title>ZEROxWORK — Online cowork</title>',
    '  <meta name="description" content="La portada.">',
    '  <meta property="og:type" content="website">',
    '  <meta property="og:title" content="ZEROxWORK — Online cowork">',
    '  <meta property="og:description" content="La portada.">',
    '  <meta property="og:url" content="https://zeroxwork.com/">',
    '  <meta property="og:image" content="https://zeroxwork.com/zeroxwork-logo.png">',
    '  <meta property="og:locale" content="en">',
    '  <meta property="og:locale:alternate" content="es">',
    '  <meta name="twitter:card" content="summary_large_image">',
    '</head>',
    '<body><div id="root"></div></body>',
    '</html>',
].join('\n');

const meta = {
    title: 'Money Grass',
    description: 'Un comic sobre el dinero.',
    image: 'https://zeroxwork.com/api/images/user-uploaded-images/portada.jpg',
    url: 'https://zeroxwork.com/portfolio/money-grass',
    type: 'website' as const,
    locale: 'es',
};

describe('el reemplazo sobre la plantilla', () => {
    it('cambia las etiquetas genericas por las de la pieza', () => {
        const html = injectSocialMeta(TEMPLATE, meta);

        expect(html).toContain('<title>Money Grass</title>');
        expect(html).toContain('<meta property="og:title" content="Money Grass">');
        expect(html).toContain('<meta property="og:description" content="Un comic sobre el dinero.">');
        expect(html).toContain('<meta property="og:image" content="https://zeroxwork.com/api/images/user-uploaded-images/portada.jpg">');
        expect(html).toContain('<meta property="og:url" content="https://zeroxwork.com/portfolio/money-grass">');
        expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
        expect(html).toContain('<meta property="og:locale" content="es">');

        // Y no deja las de la portada detras.
        expect(html).not.toContain('content="La portada."');
        expect(html).not.toContain('<title>ZEROxWORK — Online cowork</title>');
        expect(html).not.toContain('content="https://zeroxwork.com/"');
    });

    it('no toca el idioma alternativo, que no es el de la pieza', () => {
        expect(injectSocialMeta(TEMPLATE, meta))
            .toContain('<meta property="og:locale:alternate" content="es">');
    });

    it('deja la pagina en pie: el root y el script siguen ahi', () => {
        expect(injectSocialMeta(TEMPLATE, meta)).toContain('<div id="root"></div>');
    });

    it('añade lo que la plantilla no trae', () => {
        const bare = '<html><head><title>x</title></head><body></body></html>';
        const html = injectSocialMeta(bare, meta);

        expect(html).toContain('<meta property="og:image" content="https://zeroxwork.com/api/images/user-uploaded-images/portada.jpg">');
        expect(html).toContain('<meta name="twitter:title" content="Money Grass">');
        expect(html.indexOf('og:image')).toBeLessThan(html.indexOf('</head>'));
    });

    it('un titulo con comillas no rompe la etiqueta', () => {
        const html = injectSocialMeta(TEMPLATE, { ...meta, title: 'El "concurso" de <comics> & algo' });

        expect(html).toContain('<meta property="og:title" content="El &quot;concurso&quot; de &lt;comics&gt; &amp; algo">');
        expect(html).toContain('<title>El &quot;concurso&quot; de &lt;comics&gt; &amp; algo</title>');
    });

    it('una descripcion vacia deja la generica, que es mejor que ninguna', () => {
        const html = injectSocialMeta(TEMPLATE, { ...meta, description: '' });

        expect(html).toContain('<meta property="og:description" content="La portada.">');
        expect(html).toContain('<meta property="og:title" content="Money Grass">');
    });
});

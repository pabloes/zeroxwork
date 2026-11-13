import { describe, it, expect } from 'vitest';
import {
    validateTitle,
    validateSummary,
    validateContent,
    validateMode,
    validateHref,
    validateEmbedHeight,
    slugWithLetter,
    SUMMARY_MAX,
    TITLE_MAX,
    EMBED_HEIGHT_MIN,
    EMBED_HEIGHT_MAX,
    EMBED_HEIGHT_DEFAULT,
} from '../src/config/tool-fields.js';

describe('nombre y textos', () => {
    it('pide un nombre y lo recorta', () => {
        expect(validateTitle('  Brain Wallet Tool  ')).toEqual({ ok: true, value: 'Brain Wallet Tool' });
        expect(validateTitle('')).toEqual({ ok: false, code: 'TITLE_REQUIRED' });
        expect(validateTitle('   ')).toEqual({ ok: false, code: 'TITLE_REQUIRED' });
        expect(validateTitle(null)).toEqual({ ok: false, code: 'TITLE_REQUIRED' });
    });

    it('no acepta un nombre mas largo que la columna', () => {
        expect(validateTitle('x'.repeat(TITLE_MAX))).toEqual({ ok: true, value: 'x'.repeat(TITLE_MAX) });
        expect(validateTitle('x'.repeat(TITLE_MAX + 1))).toEqual({ ok: false, code: 'TITLE_LONG' });
    });

    it('el resumen vacio borra, y uno largo se rechaza', () => {
        expect(validateSummary('')).toEqual({ ok: true, value: null });
        expect(validateSummary('   ')).toEqual({ ok: true, value: null });
        expect(validateSummary('x'.repeat(SUMMARY_MAX + 1))).toEqual({ ok: false, code: 'SUMMARY_LONG' });
    });

    /**
     * La diferencia con un proyecto: dos de las tres primeras herramientas no
     * tenian ni una palabra. Exigir cuerpo solo produce relleno.
     */
    it('deja una herramienta sin una sola palabra de texto', () => {
        expect(validateContent('')).toEqual({ ok: true, value: null });
        expect(validateContent(undefined)).toEqual({ ok: true, value: null });
        expect(validateContent('  Lo que hace  ')).toEqual({ ok: true, value: 'Lo que hace' });
    });
});

describe('modo', () => {
    it('por omision salta, que es lo que no mete nada en nuestra pagina', () => {
        expect(validateMode('')).toEqual({ ok: true, value: 'link' });
        expect(validateMode(undefined)).toEqual({ ok: true, value: 'link' });
    });

    it('acepta los dos que hay y nada mas', () => {
        expect(validateMode('embed')).toEqual({ ok: true, value: 'embed' });
        expect(validateMode('EMBED')).toEqual({ ok: true, value: 'embed' });
        expect(validateMode('iframe')).toEqual({ ok: false, code: 'MODE_INVALID' });
        expect(validateMode('post')).toEqual({ ok: false, code: 'MODE_INVALID' });
    });
});

describe('donde vive la herramienta', () => {
    it('acepta una ruta de este mismo sitio', () => {
        expect(validateHref('/speed-test', 'link')).toEqual({ ok: true, value: '/speed-test' });
        expect(validateHref('  /brain-wallet  ', 'link')).toEqual({ ok: true, value: '/brain-wallet' });
    });

    it('acepta una direccion https de fuera', () => {
        expect(validateHref('https://pabloes.github.io/aave-vault-dapp/', 'embed'))
            .toEqual({ ok: true, value: 'https://pabloes.github.io/aave-vault-dapp/' });
    });

    it('pide un destino', () => {
        expect(validateHref('', 'link')).toEqual({ ok: false, code: 'HREF_REQUIRED' });
        expect(validateHref(null, 'link')).toEqual({ ok: false, code: 'HREF_REQUIRED' });
    });

    /**
     * Esto acaba en un `href` o en un `src`, asi que lo que no sea https o una
     * ruta nuestra no entra. `javascript:` es el motivo de que exista la regla.
     */
    it('no deja pasar nada que no sea https o una ruta', () => {
        expect(validateHref('javascript:alert(1)', 'link')).toEqual({ ok: false, code: 'HREF_INVALID' });
        expect(validateHref('data:text/html,<h1>hola', 'link')).toEqual({ ok: false, code: 'HREF_INVALID' });
        expect(validateHref('http://zeroxwork.com/x', 'link')).toEqual({ ok: false, code: 'HREF_INVALID' });
        expect(validateHref('zeroxwork.com/x', 'link')).toEqual({ ok: false, code: 'HREF_INVALID' });
    });

    it('rechaza la relativa al protocolo, cuyo host no avalamos', () => {
        expect(validateHref('//evil.example/x', 'link')).toEqual({ ok: false, code: 'HREF_INVALID' });
    });

    it('no deja mas larga que el campo', () => {
        expect(validateHref(`https://x.example/${'a'.repeat(500)}`, 'link'))
            .toEqual({ ok: false, code: 'HREF_INVALID' });
    });

    /**
     * Incrustar una pagina nuestra dentro de otra pagina nuestra no es
     * incrustar: la cabecera y el pie saldrian dos veces.
     */
    it('no incrusta una ruta de nuestro propio sitio', () => {
        expect(validateHref('/speed-test', 'embed')).toEqual({ ok: false, code: 'HREF_NOT_EMBEDDABLE' });
    });

    /**
     * La lista blanca que ya aplicaban los articulos con embed. Lo que se
     * incrusta corre dentro de nuestra pagina, y el sandbox solo da permisos de
     * verdad a estos origenes: colarse por la puerta nueva seria abrir lo que
     * la vieja cerraba.
     */
    it('solo incrusta los sitios de la lista blanca', () => {
        expect(validateHref('https://pabloes.github.io/aave-vault-dapp/', 'embed').ok).toBe(true);
        expect(validateHref('https://otro.github.io/app', 'embed'))
            .toEqual({ ok: false, code: 'EMBED_HOST_NOT_ALLOWED' });
        expect(validateHref('https://evil.example/app', 'embed'))
            .toEqual({ ok: false, code: 'EMBED_HOST_NOT_ALLOWED' });
    });

    it('incrusta las piezas de /embeds/, que estan servidas para eso', () => {
        expect(validateHref('/embeds/mi-tool/', 'embed')).toEqual({ ok: true, value: '/embeds/mi-tool/' });
    });

    it('pero saltar a cualquier sitio https sigue valiendo', () => {
        // Un enlace no corre dentro de nuestra pagina: no hay nada que aislar.
        expect(validateHref('https://otro.github.io/app', 'link'))
            .toEqual({ ok: true, value: 'https://otro.github.io/app' });
    });
});

describe('alto de lo que se incrusta', () => {
    it('en modo salto no hay nada que medir', () => {
        expect(validateEmbedHeight(1000, 'link')).toEqual({ ok: true, value: null });
        expect(validateEmbedHeight('', 'link')).toEqual({ ok: true, value: null });
    });

    it('sin decir nada, el alto de siempre', () => {
        expect(validateEmbedHeight('', 'embed')).toEqual({ ok: true, value: EMBED_HEIGHT_DEFAULT });
        expect(validateEmbedHeight(undefined, 'embed')).toEqual({ ok: true, value: EMBED_HEIGHT_DEFAULT });
    });

    it('acepta los extremos y rechaza lo de fuera', () => {
        expect(validateEmbedHeight(EMBED_HEIGHT_MIN, 'embed')).toEqual({ ok: true, value: EMBED_HEIGHT_MIN });
        expect(validateEmbedHeight(EMBED_HEIGHT_MAX, 'embed')).toEqual({ ok: true, value: EMBED_HEIGHT_MAX });
        // La de AAVE pide 1000: 600 no podia ser el techo.
        expect(validateEmbedHeight(1000, 'embed')).toEqual({ ok: true, value: 1000 });
        expect(validateEmbedHeight(EMBED_HEIGHT_MIN - 1, 'embed')).toEqual({ ok: false, code: 'EMBED_HEIGHT_INVALID' });
        expect(validateEmbedHeight(EMBED_HEIGHT_MAX + 1, 'embed')).toEqual({ ok: false, code: 'EMBED_HEIGHT_INVALID' });
    });

    it('rechaza lo que no es un numero entero', () => {
        expect(validateEmbedHeight('alto', 'embed')).toEqual({ ok: false, code: 'EMBED_HEIGHT_INVALID' });
        expect(validateEmbedHeight(600.5, 'embed')).toEqual({ ok: false, code: 'EMBED_HEIGHT_INVALID' });
    });
});

describe('slug', () => {
    it('pone una letra delante cuando el slug es solo numeros', () => {
        // Si no, /tools/2024 chocaria con /tools/<id>, que siempre funciona.
        expect(slugWithLetter('2024')).toBe('t-2024');
        expect(slugWithLetter('speed-test')).toBe('speed-test');
    });
});

import { describe, it, expect } from 'vitest';
import { validateHandle, HANDLE_MAX } from '../src/config/profile.js';

describe('member handle validation', () => {
    it('clears the handle on null, undefined or blank input', () => {
        for (const input of [null, undefined, '', '   ']) {
            expect(validateHandle(input)).toEqual({ ok: true, value: null });
        }
    });

    it('accepts a normal handle and lowercases it', () => {
        expect(validateHandle('carlosmu')).toEqual({ ok: true, value: 'carlosmu' });
        expect(validateHandle('  CarlosMu  ')).toEqual({ ok: true, value: 'carlosmu' });
        expect(validateHandle('maria-lopez')).toEqual({ ok: true, value: 'maria-lopez' });
        expect(validateHandle('x1y2')).toEqual({ ok: true, value: 'x1y2' });
    });

    it('rejects handles that are too short or too long', () => {
        expect(validateHandle('ab')).toEqual({ ok: false, code: 'HANDLE_LENGTH' });
        expect(validateHandle('a'.repeat(HANDLE_MAX + 1))).toEqual({ ok: false, code: 'HANDLE_LENGTH' });
    });

    it('rejects anything that would not survive being part of a URL', () => {
        for (const bad of ['con espacio', 'punto.com', 'bajo_guion', 'acentuado-ñ', 'slash/es', 'at@sign', '¡hola!']) {
            expect(validateHandle(bad)).toEqual({ ok: false, code: 'HANDLE_INVALID' });
        }
    });

    it('rejects hyphens at the edges and doubled up', () => {
        for (const bad of ['-pablo', 'pablo-', 'pa--blo']) {
            expect(validateHandle(bad)).toEqual({ ok: false, code: 'HANDLE_INVALID' });
        }
    });

    it('rejects reserved handles, whatever the casing', () => {
        for (const reserved of ['admin', 'ADMIN', 'api', 'zeroxwork', 'portfolio', 'members', 'anonymous']) {
            expect(validateHandle(reserved)).toEqual({ ok: false, code: 'HANDLE_RESERVED' });
        }
    });

    it('does not reserve handles that merely contain a reserved word', () => {
        expect(validateHandle('administrator-pablo')).toEqual({ ok: true, value: 'administrator-pablo' });
        expect(validateHandle('apiary')).toEqual({ ok: true, value: 'apiary' });
    });
});

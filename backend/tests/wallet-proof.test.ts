import { describe, it, expect } from 'vitest';
import { WALLET_PROOF_TTL_MS, checkWalletProof, createWalletProof, normalizeAddress } from '../src/services/wallet-proof.js';

const SECRET = 'a-secret-for-tests';
const SITE = 'zeroxwork.com';
const NOW = 1_800_000_000_000;
const WALLET = '0x52908400098527886e0f7030069857d2e4169ee7';
const OTHER = '0x8617e340b3d01fa5f11f306f4090fd50e238070d';

describe('wallet addresses', () => {
    it('are kept lower case, whatever case they arrive in', () => {
        expect(normalizeAddress('0x52908400098527886E0F7030069857D2E4169EE7')).toBe(WALLET);
        expect(normalizeAddress(` ${WALLET} `)).toBe(WALLET);
    });

    it('are refused when they are not addresses', () => {
        for (const input of [null, undefined, 42, {}, '', '0x123', 'vitalik.eth', `${WALLET}00`, WALLET.slice(2), '0xZZ908400098527886e0f7030069857d2e4169ee7']) {
            expect(normalizeAddress(input)).toBeNull();
        }
    });
});

describe('the text a wallet is asked to sign', () => {
    const proof = createWalletProof(SECRET, SITE, 12, WALLET, NOW);

    it('says who is asking, for which wallet and account, and until when', () => {
        expect(proof.message).toContain('zeroxwork.com wants to link this wallet');
        expect(proof.message).toContain(`Wallet: ${WALLET}`);
        expect(proof.message).toContain('Account: 12');
        expect(proof.message).toContain(`Code: ${proof.code}`);
        expect(proof.message).toContain(`Valid until: ${new Date(NOW + WALLET_PROOF_TTL_MS).toISOString()}`);
        expect(proof.message).toContain('does not move funds');
        expect(proof.expires).toBe(NOW + WALLET_PROOF_TTL_MS);
    });

    it('is rebuilt identically when the proof comes back', () => {
        const check = checkWalletProof(SECRET, SITE, { userId: 12, address: WALLET, expires: proof.expires, code: proof.code }, NOW + 1000);
        expect(check).toEqual({ ok: true, message: proof.message });
    });

    it('is not accepted for another account, another wallet or a later expiry', () => {
        const base = { userId: 12, address: WALLET, expires: proof.expires, code: proof.code };
        expect(checkWalletProof(SECRET, SITE, { ...base, userId: 13 }, NOW)).toEqual({ ok: false, reason: 'forged' });
        expect(checkWalletProof(SECRET, SITE, { ...base, address: OTHER }, NOW)).toEqual({ ok: false, reason: 'forged' });
        expect(checkWalletProof(SECRET, SITE, { ...base, expires: proof.expires + 60_000 }, NOW)).toEqual({ ok: false, reason: 'forged' });
        expect(checkWalletProof('another-secret', SITE, base, NOW)).toEqual({ ok: false, reason: 'forged' });
    });

    it('expires', () => {
        const base = { userId: 12, address: WALLET, expires: proof.expires, code: proof.code };
        expect(checkWalletProof(SECRET, SITE, base, proof.expires)).toMatchObject({ ok: true });
        expect(checkWalletProof(SECRET, SITE, base, proof.expires + 1)).toEqual({ ok: false, reason: 'expired' });
    });

    it('answers "malformed" to a proof that is not one, such as the old fixed message', () => {
        const junk: { expires: unknown; code: unknown }[] = [
            { expires: undefined, code: undefined },
            { expires: String(proof.expires), code: proof.code },
            { expires: proof.expires, code: 'Binding wallet' },
            { expires: proof.expires, code: 42 },
            { expires: 1.5, code: proof.code },
        ];
        for (const { expires, code } of junk) {
            expect(checkWalletProof(SECRET, SITE, { userId: 12, address: WALLET, expires, code }, NOW)).toEqual({ ok: false, reason: 'malformed' });
        }
    });

    it('differs for the same wallet on two accounts, so one signature cannot serve both', () => {
        const mine = createWalletProof(SECRET, SITE, 12, WALLET, NOW);
        const theirs = createWalletProof(SECRET, SITE, 13, WALLET, NOW);
        expect(mine.message).not.toBe(theirs.message);
        expect(mine.code).not.toBe(theirs.code);
    });
});

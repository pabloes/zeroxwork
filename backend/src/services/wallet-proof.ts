/**
 * What a wallet has to sign before we believe it belongs to an account.
 *
 * It used to be the fixed text "Binding wallet", and the server did not even
 * check the text: any signature that wallet had ever made, of anything, linked
 * it to whoever sent it in. A wallet address is unique here, so the first
 * account to claim it kept it, along with the names it owns.
 *
 * Now the server writes the message. It names the site, the wallet and the
 * account, carries an expiry, and a code only we can produce for that exact
 * combination. A signature is good for that account, that wallet and those
 * ten minutes, and for nothing else.
 *
 * Nothing is stored: the code is a keyed digest of what it vouches for, so it
 * can be checked again when the signature comes back. Using it twice only
 * links the same wallet to the same account again.
 *
 * Pure: the secret and the site come in as arguments.
 */
import crypto from 'crypto';

export const WALLET_PROOF_TTL_MS = 10 * 60 * 1000;

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function normalizeAddress(raw: unknown): string | null {
    return typeof raw === 'string' && ADDRESS.test(raw.trim()) ? raw.trim().toLowerCase() : null;
}

function codeFor(secret: string, userId: number, address: string, expires: number): string {
    const key = crypto.createHmac('sha256', secret).update('zeroxwork:wallet-proof:v1').digest();
    return crypto.createHmac('sha256', key).update(`${userId}\n${address}\n${expires}`).digest('hex').slice(0, 32);
}

/** The exact text the wallet shows and signs. Any change here invalidates proofs in flight. */
export function walletBindMessage(site: string, userId: number, address: string, expires: number, code: string): string {
    return [
        `${site} wants to link this wallet to your ZEROxWORK account.`,
        '',
        `Wallet: ${address}`,
        `Account: ${userId}`,
        `Code: ${code}`,
        `Valid until: ${new Date(expires).toISOString()}`,
        '',
        'Signing only proves the wallet is yours. It does not move funds or approve any transaction.',
    ].join('\n');
}

export interface WalletProof {
    message: string;
    expires: number;
    code: string;
}

export function createWalletProof(secret: string, site: string, userId: number, address: string, now = Date.now()): WalletProof {
    const expires = now + WALLET_PROOF_TTL_MS;
    const code = codeFor(secret, userId, address, expires);
    return { message: walletBindMessage(site, userId, address, expires, code), expires, code };
}

export type WalletProofCheck =
    | { ok: true; message: string }
    | { ok: false; reason: 'malformed' | 'forged' | 'expired' };

/**
 * Rebuilds the message the server would have written for this account and
 * wallet. The caller verifies the signature against that, never against a
 * text the client supplies.
 */
export function checkWalletProof(
    secret: string,
    site: string,
    claim: { userId: number; address: string; expires: unknown; code: unknown },
    now = Date.now(),
): WalletProofCheck {
    const { userId, address, expires, code } = claim;
    if (typeof expires !== 'number' || !Number.isSafeInteger(expires) || typeof code !== 'string' || !/^[0-9a-f]{32}$/.test(code)) {
        return { ok: false, reason: 'malformed' };
    }
    const expected = codeFor(secret, userId, address, expires);
    if (!crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return { ok: false, reason: 'forged' };
    if (now > expires) return { ok: false, reason: 'expired' };
    return { ok: true, message: walletBindMessage(site, userId, address, expires, code) };
}

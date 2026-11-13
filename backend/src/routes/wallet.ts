import express, {Request, Response} from 'express';
import rateLimit from 'express-rate-limit';
import { verifySignature, addWalletToUser } from '../services/web3-service';
import {verifyToken} from "../middleware/authMiddleware";
import {prisma} from "../db";
import {updateUserExtraSpace, updateWalletNames} from "../services/decentraland-names";
import { env } from '../config/env.js';
import { SITE_URL } from '../config/site.js';
import { checkWalletProof, createWalletProof, normalizeAddress } from '../services/wallet-proof.js';

const router = express.Router();

/** The name the wallet shows above the text it is asked to sign. */
const SITE_HOST = new URL(SITE_URL).host;

const bindLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many requests. Try again later.' },
});

const refuse = (res: Response, error: string, code: string) => res.status(400).json({ error, code });

/** Set by verifyToken, which runs before every handler that calls this. */
const sessionUserId = (req: Request): number => (req as Request & { user: { id: number } }).user.id;

/**
 * The text this account has to sign with that wallet. Written here, not in the
 * page: a signature of anything else proves nothing. See services/wallet-proof.ts.
 */
router.get('/bind-message', verifyToken, bindLimiter, (req: Request, res: Response) => {
    const address = normalizeAddress(req.query.address);
    if (!address) return refuse(res, 'That is not a wallet address.', 'WALLET_ADDRESS_INVALID');
    res.set('Cache-Control', 'no-store');
    res.json(createWalletProof(env.JWT_SECRET, SITE_HOST, sessionUserId(req), address));
});

router.post('/bind', verifyToken, bindLimiter, async (req: Request, res: Response) => {
    const userId = sessionUserId(req);
    const { signature, expires, code } = req.body ?? {};

    const address = normalizeAddress(req.body?.address);
    if (!address) return refuse(res, 'That is not a wallet address.', 'WALLET_ADDRESS_INVALID');
    if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signature)) {
        return refuse(res, 'Invalid signature', 'WALLET_SIGNATURE_INVALID');
    }

    // The message is rebuilt here from the session and the address. Whatever
    // text the client says it signed is not looked at.
    const proof = checkWalletProof(env.JWT_SECRET, SITE_HOST, { userId, address, expires, code });
    if (!proof.ok) {
        const text = proof.reason === 'expired'
            ? 'The request to sign expired. Try again.'
            : 'This page is out of date. Reload it and link the wallet again.';
        return refuse(res, text, proof.reason === 'expired' ? 'WALLET_PROOF_EXPIRED' : 'WALLET_PROOF_INVALID');
    }

    try {
        // throws on a signature that is not one: treated the same as a wrong one
        const isValid = await verifySignature(address, signature as any, proof.message).catch(() => false);
        if (!isValid) return refuse(res, 'Invalid signature', 'WALLET_SIGNATURE_INVALID');

        await addWalletToUser(userId, address);
        const user = await prisma.user.findUnique({
            where: { id:userId },
            include: {
                wallets: {
                    include: {
                        walletNames: true
                    }
                }
            }
        });

        await updateUserExtraSpace(user as any);
        // The whole row used to go back, password hash included. Nothing on the
        // page reads it, but a hash has no business leaving the server.
        const { password: _password, verificationCode: _verificationCode, ...safeUser } = user ?? ({} as any);
        res.json({ success: true, user: user ? safeUser : null });
    } catch (error) {
        // the address is unique: somebody else linked it first
        if ((error as { code?: string })?.code === 'P2002') {
            return refuse(res, 'That wallet is already linked to another account.', 'WALLET_TAKEN');
        }
        console.error('Wallet bind failed with an unexpected error');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint para obtener las wallets vinculadas al usuario
router.get('/wallets', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id; // Obtener el ID del usuario desde el token
        const wallets = await prisma.wallet.findMany({
            where: { userId },
            include: { walletNames:true }
        });
        res.json(wallets);
    } catch (error) {
        console.error('Error fetching wallets:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete("/:address", verifyToken,async (req: Request, res: Response) => {
    try{
        const {address} = req.params
        const userId = parseInt(req.user.id); // Asumiendo que `req.user` tiene la información del usuario autenticado
        const foundWallet = await prisma.wallet.findFirst({where:{userId, address}})
        if(!foundWallet){
            return res.status(500).send({error: "Not found", message:"Not found"});
        }
        const result = await prisma.wallet.delete({where:{id:foundWallet.id}});
        const user = await prisma.user.findUnique({
            where: { id:userId },
            include: {
                wallets: {
                    include: {
                        walletNames: true
                    }
                }
            }
        });
        await updateUserExtraSpace(user);

        res.status(200).json({ message: 'Wallet removed successfully' });
    }catch(error){
        console.error('Error removing wallet:', error);
        res.status(500).json({ error: 'Internal server error' });
    }

});
export default router;

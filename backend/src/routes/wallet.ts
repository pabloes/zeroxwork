import express from 'express';
import { verifySignature, addWalletToUser } from '../services/web3-service';
import {verifyToken} from "../middleware/authMiddleware";
import {prisma} from "../db";

const router = express.Router();

router.post('/bind', verifyToken, async (req, res) => {
    console.log("bind")
    const userId = req.user.id;
    const { address, signature, message } = req.body;

    if (!userId || !address || !signature || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const isValid = await verifySignature(address, signature, message);

    if (!isValid) {
        return res.status(400).json({ error: 'Invalid signature' });
    }

    // Añadir la wallet al usuario
    await addWalletToUser(userId, address.toLowerCase());
    res.json({ success: true });
});

// Endpoint para obtener las wallets vinculadas al usuario
router.get('/wallets', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id; // Obtener el ID del usuario desde el token
        const wallets = await prisma.wallet.findMany({
            where: { userId },
            include: { walletDecentralandNames:true }
        });
        res.json(wallets);
    } catch (error) {
        console.error('Error fetching wallets:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

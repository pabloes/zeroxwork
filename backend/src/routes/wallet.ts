import express, {Request, Response} from 'express';
import { verifySignature, addWalletToUser } from '../services/web3-service';
import {verifyToken} from "../middleware/authMiddleware";
import {prisma} from "../db";
import {updateUserExtraSpace, updateWalletNames} from "../services/decentraland-names";

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
    await addWalletToUser(userId, address.toLowerCase());
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
    // Añadir la wallet al usuario

    await updateUserExtraSpace(user);
    res.json({ success: true, user });
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

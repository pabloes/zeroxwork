import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
const router = Router();
import {prisma} from "../db";


router.get('/quota', verifyToken, async (req: Request, res: Response) => {
    try {
        res.json(await getUserQuota(req.user.id));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching quota information', error: error.message });
    }
});

router.post('/set-default-name', verifyToken, async (req: Request, res: Response) => {
    const { nameId } = req.body;
    const userId = req.user.id;

    try {
        // Check if the nameId is valid and belongs to the user's wallet
        const name = await prisma.walletDecentralandNames.findFirst({
            where: {
                id: nameId,
                wallet: {
                    userId: userId,
                },
            },
        });

        if (!name) {
            return res.status(404).json({ message: 'Name not found or does not belong to the user.' });
        }

        // Update user's defaultNameId
        await prisma.user.update({
            where: { id: userId },
            data: {
                defaultNameId: nameId,
            },
        });

        return res.json({ message: 'Default name updated successfully.' });
    } catch (error) {
        console.error('Error setting default name:', error);
        return res.status(500).json({ message: 'Error setting default name', error: error.message });
    }
});

export async function getUserQuota(userId){
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            maxQuota: true,
            extraQuota: true,
            fileUploads: {
                select: {
                    fileSize: true
                }
            }
        }
    });

    // Calculate total used quota if needed
    const totalUsedQuota = user.fileUploads.reduce((sum, file) => sum + file.fileSize, 0);

    return {
        ...user,
        usedQuota: totalUsedQuota,

    }
}

export default router;
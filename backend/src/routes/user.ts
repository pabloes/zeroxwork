import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
const router = Router();
import {prisma} from "../db";
import NodeCache from 'node-cache';
import axios from "axios";
import sharp from "sharp";

const cache = new NodeCache({ stdTTL: 60 * 60 * 24 }); // Cache expires in 24 hours
const DECENTRALAND_API_URL = 'https://peer.decentraland.org/lambdas/profiles';
router.get('/me', verifyToken, async (req: Request, res: Response) => {
    try {
        // Fetch the authenticated user's information
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },  // `req.user.id` is set by `verifyToken` middleware
            include: {
                defaultName: { // This refers to the relation in the Prisma schema
                    select: {
                        id: true,
                        name: true,
                        wallet: { // Fetch the wallet information associated with this name
                            select: {
                                address: true,
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Construct the response payload
        const response = {
            id: user.id,
            email: user.email,
            defaultName: user.defaultName ? {
                id: user.defaultName.id,
                name: user.defaultName.name,
                walletAddress: user.defaultName.wallet.address,
            } : null,
        };

        res.json(response); // Return the user information as JSON

    } catch (error) {
        console.error('Error fetching user information:', error);
        res.status(500).json({ message: 'Error fetching user information', error: error.message });
    }
});
router.get('/decentraland-avatar/:address', async (req: Request, res: Response) => {
    const { address } = req.params;

    // Check if the image is cached
    const cachedAvatar = cache.get(address);
    if (cachedAvatar) {
        console.log('Serving cached avatar for:', address);
        res.setHeader('Content-Type', 'image/png');
        return res.send(cachedAvatar);
    }

    try {
        // Fetch avatar data from Decentraland API
        const profileResponse = await axios.post(DECENTRALAND_API_URL, {
            ids: [address],
        });

        const avatarData = profileResponse.data[0]?.avatars[0];
        if (!avatarData) {
            return res.status(404).json({ message: 'Avatar not found for this address' });
        }

        const avatarImageUrl = avatarData.avatar.snapshots.face256;

        // Fetch the image from the Decentraland avatar URL (as binary data)
        const imageResponse = await axios.get(avatarImageUrl, { responseType: 'arraybuffer' });

        // Optional: If you need to convert the image to PNG (if it's not already in PNG format)
        const pngBuffer = await sharp(imageResponse.data).png().toBuffer();

        // Cache the binary data for future use
        cache.set(address, pngBuffer);

        // Return the image as a response with correct headers
        res.setHeader('Content-Type', 'image/png');
        return res.send(pngBuffer);
    } catch (error) {
        console.error('Error fetching avatar image:', error);
        return res.status(500).json({ message: 'Error fetching avatar image', error: error.message });
    }
});

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

router.post('/fetch-avatar', verifyToken, async (req: Request, res: Response) => {
    const { walletAddress } = req.body;

    try {
        const response = await axios.post('https://peer.decentraland.org/lambdas/profiles', {
            ids: [walletAddress],
        });

        if (response.data && response.data.length > 0) {
            const avatar = response.data[0]?.avatars[0];
            const avatarImageUrl = avatar.snapshots.face256;
            return res.json({ avatarImageUrl, name: avatar.name });
        } else {
            return res.status(404).json({ message: 'Avatar not found for this address' });
        }
    } catch (error) {
        console.error('Error fetching avatar:', error);
        return res.status(500).json({ message: 'Error fetching avatar', error: error.message });
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
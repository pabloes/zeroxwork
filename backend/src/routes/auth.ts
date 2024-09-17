import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const router = Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await argon2.hash(password);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
            },
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error creating user' });
    }
});

export default router;

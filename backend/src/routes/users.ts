import * as argon2 from "argon2";
import {prisma} from '../db/index.js';
import {Router} from 'express';

const router = Router();
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = await argon2.hash(password);
    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
        },
    });
    res.json(user);
});
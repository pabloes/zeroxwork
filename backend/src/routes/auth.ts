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
            data: { email, password: hashedPassword },
        });
        res.json(user);
    } catch (error) {
        if(error.meta.target.indexOf("email")>=0) return res.status(500).json({error:"This email is already registered"});
        res.status(500).json({ error: 'Error creating user' });
    }
});
// Nueva ruta para inicio de sesión
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await argon2.verify(user.password, password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Aquí puedes agregar lógica para crear una sesión o token JWT
        res.json({ message: 'Login successful' });
    } catch (error) {
        res.status(500).json({ error: 'Error logging in' });
    }
});

export default router;

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import {sendMail} from "../services/mailer";

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
import jwt from 'jsonwebtoken';

router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await argon2.hash(password);
        const verificationCode =Math.random().toString().slice(2,20);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword, verificationCode },
        });

        //TODO send mail
        try{
            await sendMail(
                email,
                "ZEROxWORK mail verification",
                `<p>Please click on the following link to verify your account:</p>
                        <a href="http://zeroxwork.com/verify?token=${verificationCode}">Verify Account</a>`
            );
            res.json({ message: 'User registered. Please check your email to verify your account.' });
        }catch(error){
            console.log("error",error)
            res.status(400).send({error})
        }

    } catch (error) {
        if(error.meta.target.indexOf("email")>=0) return res.status(500).json({error:"This email is already registered"});
        res.status(500).json({ error: 'Error creating user' });
    }
});
router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
//TODO if not verified return error

    try {
        // Verificar que el usuario exista en la base de datos
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }else if(!user.verified){
            return res.status(403).json({ error: 'Email not verified. Look your mail inbox.' });
        }

        // Verificar que la contraseña sea correcta con argon2
        const isPasswordValid = await argon2.verify(user.password, password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Generar un token JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: 10000 }
        );

        // Enviar el token como respuesta
        res.json({ token });
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.post('/api/auth/verify', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Token is required.' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { verificationCode:token },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (user.verified) {
            return res.status(400).json({ message: 'User is already verified.' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { verified: true },
        });

        return res.json({ message: 'Email has been successfully verified!' });
    } catch (error) {
        return res.status(400).json({ message: 'Invalid verification token.' });
    }
});

export default router;

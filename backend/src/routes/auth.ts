import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import {sendMail} from "../services/mailer";

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
import jwt from 'jsonwebtoken';
// Register Endpoint
router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        // Check if the user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({ message: 'Email is already registered.' });
        }

        // Hash the password
        const hashedPassword = await argon2.hash(password);

        // Create new user in the database
        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                verified: false, // User is not verified yet
            },
        });

        // Create a verification token
        const verificationToken = jwt.sign(
            { userId: newUser.id },
            JWT_SECRET,
            { expiresIn: '6h' } // Token expires in 1 hour
        );

        // Send verification email
        const verificationUrl = `http://zeroxwork.com/verify?token=${verificationToken}`;
        await sendMail(
            email,
            "ZEROxWORK email verification",
            `<p>Please click on the following link to verify your account, the token expires in 6 hours:</p>
                        <a href="${verificationUrl}">Verify Email</a>`
        );
        res.json({ message: 'Registration successful! Please check your email to verify your account. The token expires in 6 hours.' });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Internal server error. Please try again later.' });
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


router.post('/verify', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Token is required.' });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if user exists in the database
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Check if user is already verified
        if (user.verified) {
            return res.status(400).json({ message: 'User is already verified.' });
        }
        if((user.exp *1000) < Date.now()){
            return res.status(400).json({ message: 'This token is expired.' });
        }
        // Update the user's verified status
        await prisma.user.update({
            where: { id: user.id },
            data: { verified: true },
        });

        return res.json({ message: 'Email has been successfully verified!' });
    } catch (error) {
        // Handle verification errors
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ message: 'Verification token has expired.' });
        }
        return res.status(400).json({ message: 'Invalid verification token.' });
    }
});

export default router;

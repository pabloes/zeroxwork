import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import {sendMail} from "../services/mailer";

const router = Router();
const prisma = new PrismaClient();

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

router.post("/verify", async (req, res) => {
    const {token} = req.query;
    try {
        //TODO check that the verificationCode is the same than in database
        const user = await prisma.user.findFirst({ where: { verificationCode: token } });
        if(!user){
            return res.status(400).send({error:"User not found"})
        }else if(!user.verified){
            return res.status(400).send({error:"User not verified"})
        }
        if(user.verificationCode === verificationCode){
            user.update({
                data:{
                    verified:true
                }
            });
        }else{
            return res.status(400).send({error:"Wrong code"})
        }
    }catch(error){
        return res.send({error})
    }
});

export default router;

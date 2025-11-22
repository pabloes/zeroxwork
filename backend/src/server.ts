import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import options from "../adminjs/config";
import initializeDb, { prisma } from './db/index';
import path, {dirname} from "path";
import cors from 'cors';
import session from 'express-session';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import {fileURLToPath} from "url";
import argon2 from 'argon2';
import imageRoutes from './routes/image';
import userRoutes from "./routes/user";
import walletRoutes from "./routes/wallet";
import blogRoutes from "./routes/blog";
import { ROLE } from './constants/roles';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();

const run = async () => {
    await initializeDb();

    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use(cors({
        allowedHeaders:['Content-Type', 'Authorization', "X-API-Key"]
    }));
    app.use(
        session({
            secret: process.env.SESSION_SECRET || 'localhost',
            resave: false,
            saveUninitialized: false,
        })
    );
    const admin = new AdminJS(options);
    const router = AdminJSExpress.buildAuthenticatedRouter(admin, {
        authenticate: async (email, password) => {
            const userCount = await prisma.user.count();
            if(userCount === 0) return true;
            const user = await prisma.user.findFirst({where:{ email }});
            if(!user) return false;
            if(!await argon2.verify(user.password,password)){
                return false;
            }
            if (user.role !== ROLE.ADMIN) { // Verifica si el usuario es administrador
                return false;
            }
            return user;
        },
        cookiePassword: process.env.ADMIN_COOKIE_PASSWORD,
    }, undefined );

    app.use(admin.options.rootPath, router);

    app.use('/api/images/user-uploaded-images', express.static('public/user-uploaded-images'));
    app.use('/api/auth', authRoutes);
    app.use('/api/images', imageRoutes);
    app.use('/api/user', userRoutes);
    app.use('/api/wallet', walletRoutes);
    app.use('/api/blog', blogRoutes);

    const port = process.env.PORT || 3000;
    console.log("Listening...")
    const frontendDistPath = path.join(__dirname, '../../frontend/dist');

    app.use(express.static(frontendDistPath));
    app.use("/hello/world", (req, res)=>{
        return res.send("hello world1");
    })

    app.use("/hello", (req, res)=>{
        return res.send("hello1")
    })
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
    app.get('*', (req, res) => {
        console.log("*", req.hostname, req.url)
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });

    app.listen(port, () => {
        console.log(`--->Running in port ${port}`);
    });
}

run()
    .finally(async () => {
        await prisma.$disconnect();
    });

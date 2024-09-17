import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import { adminRouter } from '../adminjs/config';

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'localhost',
        resave: false,
        saveUninitialized: false,
    })
);
app.use('/auth', authRoutes);

// Montar AdminJS en '/admin'
app.use('/admin', adminRouter);

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`Running in port ${port}`);
});

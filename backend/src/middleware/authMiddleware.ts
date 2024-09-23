import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization']?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No token provided' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
        req.user = verified; // Assuming user information is stored in the token
        if((verified.exp *1000) < Date.now()){
            throw new jwt.TokenExpiredError("Session expired", verified.iat);
        }
        next();
    } catch (error) {
        res.status(401).json(error);
    }
};

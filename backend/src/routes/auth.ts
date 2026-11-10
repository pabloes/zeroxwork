import { Router } from 'express';
import argon2 from 'argon2';
import {MailDeliveryError, sendMail} from "../services/mailer";
import { InvalidSocialError, normalizeSocial } from '../constants/social-networks';
import { notifyAdminNewUser } from '../services/admin-notify';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { prisma } from '../db';
import { freeHandle } from '../services/public-handle.js';
import { validateDisplayName, validateHandle } from '../config/profile.js';
import { ImageRejected, storeImageBuffer } from './image.js';
import { avatarBuffer } from '../config/avatar-data-url.js';

const router = Router();
import {updateUserExtraSpace, updateWalletNames} from "../services/decentraland-names";

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { message: 'Too many requests. Try again later.' },
});

router.post('/register', authLimiter, async (req, res) => {
    const { email, password, socials, displayName, handle, avatar } = req.body;

    // Both `error` and `message` are sent on failures: the Register page reads
    // `error`, while older clients read `message`.
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.', message: 'Email and password are required.' });
    }

    const fail = (text: string, code?: string) =>
        res.status(400).json({ error: text, message: text, ...(code ? { code } : {}) });

    try {
        // Check if the user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Email is already registered.', message: 'Email is already registered.' });
        }

        // Everything is validated before the account exists: a bad handle must
        // not leave a half-registered user behind.
        let socialRows: { network: string; handle: string }[];
        try {
            socialRows = normalizeSocials(socials);
        } catch (socialError) {
            if (socialError instanceof InvalidSocialError) {
                return res.status(400).json({ error: socialError.message, message: socialError.message });
            }
            throw socialError;
        }

        // The public name and the address of the member page are asked for at
        // sign-up now, not left for /account: an account with neither shows up
        // in credits and in the directory as `member-12`, and in practice it
        // stays that way.
        const checkedName = validateDisplayName(displayName);
        if (!checkedName.ok) return fail('That public name cannot be used.', checkedName.code);
        if (!checkedName.value) return fail('A public name is required.', 'DISPLAY_NAME_REQUIRED');

        const checkedHandle = validateHandle(handle);
        if (!checkedHandle.ok) return fail('That address cannot be used.', checkedHandle.code);
        if (!checkedHandle.value) return fail('An address is required.', 'HANDLE_REQUIRED');

        // The form already asked whether this handle was free, but that answer
        // is a snapshot and the client is not to be trusted with uniqueness
        // either way. This is the check that counts; it hands back a suffixed
        // handle rather than refusing a registration over a name clash.
        const resolvedHandle = await freeHandle(checkedHandle.value);
        if (!resolvedHandle) {
            const text = 'Internal server error. Please try again later.';
            return res.status(500).json({ error: text, message: text });
        }

        const avatarBytes = avatarBuffer(avatar);
        if (avatar && !avatarBytes) return fail('That image could not be read.', 'AVATAR_INVALID');

        // Hash the password
        const hashedPassword = await argon2.hash(password);

        // Create new user in the database
        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                verified: false, // User is not verified yet
                displayName: checkedName.value,
                handle: resolvedHandle,
                socials: socialRows.length ? { create: socialRows } : undefined,
            },
        });

        // The avatar can only be stored once the account owns it. It goes
        // through the same pipeline as any other upload (virus scan, content
        // scan, quota row), and it is never the reason a registration fails:
        // the member can always set one later from /account.
        let avatarStored = false;
        if (avatarBytes) {
            try {
                const stored = await storeImageBuffer(avatarBytes, avatarBytes.length, newUser.id);
                if (stored.banned) {
                    console.warn('Registration: avatar rejected by the content scan for', email);
                } else {
                    await prisma.user.update({ where: { id: newUser.id }, data: { avatarUrl: stored.servedUrl } });
                    avatarStored = true;
                }
            } catch (avatarError) {
                const why = avatarError instanceof ImageRejected ? avatarError.code : avatarError;
                console.error('Registration: avatar could not be stored for', email, why);
            }
        }

        // Tell the owner the account exists. Not awaited (the response must not
        // wait on SMTP) and it never rejects, but keep the catch anyway so a
        // future change cannot turn this into an unhandled rejection.
        notifyAdminNewUser(newUser.email, newUser.createdAt)
            .catch((err: any) => console.error('Admin notify error:', err));

        try {
            await sendVerificationMail(newUser.id, email);
        } catch (mailError) {
            // The account exists but the verification mail never left. Say so
            // instead of telling the user to check an inbox that stays empty:
            // they can ask for a new mail from the login page.
            console.error('Registration: verification mail failed for', email, mailError);
            const text = 'Your account was created, but we could not send the verification email. Please try again from the login page in a few minutes.';
            return res.status(502).json({ error: text, message: text, accountCreated: true, mailSent: false, handle: resolvedHandle, avatarStored });
        }

        res.json({
            message: 'Registration successful! Please check your email to verify your account. The token expires in 6 hours.',
            mailSent: true,
            // The handle actually stored, which is not always the one asked for:
            // the page tells them their address instead of letting them find out.
            handle: resolvedHandle,
            avatarStored,
        });
    } catch (error) {
        // P2002 on the handle: somebody claimed it between the check and the
        // insert. Rare enough to answer with "try again" rather than retrying
        // here, because by now the password has been hashed and the email may
        // have been taken too.
        if ((error as any)?.code === 'P2002') {
            const text = 'That address was just taken. Please pick another one.';
            return res.status(409).json({ error: text, message: text, code: 'HANDLE_TAKEN' });
        }
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Internal server error. Please try again later.', message: 'Internal server error. Please try again later.' });
    }
});

/**
 * Takes the form's `{ network: handle }` object and returns the rows worth
 * storing. Blank values are dropped; unknown networks and unusable handles
 * throw InvalidSocialError. Keys are unique, so the catalogue bounds the size.
 */
function normalizeSocials(socials: unknown): { network: string; handle: string }[] {
    if (!socials || typeof socials !== 'object' || Array.isArray(socials)) return [];

    const rows: { network: string; handle: string }[] = [];
    for (const [network, raw] of Object.entries(socials as Record<string, unknown>)) {
        if (typeof raw !== 'string') continue;
        const normalized = normalizeSocial(network, raw);
        if (normalized) rows.push(normalized);
    }
    return rows;
}

async function sendVerificationMail(userId, email){
    const verificationToken = jwt.sign(
        { userId },
        env.JWT_SECRET,
        { expiresIn: '6h' } // Token expires in 1 hour
    );
    const verificationUrl = `https://zeroxwork.com/verify?token=${verificationToken}`;
    await sendMail(
        email,
        "ZEROxWORK email verification",
        `<p>Please click on the following link to verify your account, the token expires in 6 hours:</p>
                        <a href="${verificationUrl}">Verify Email</a>`
    );
}

router.post('/login', authLimiter, async (req: Request, res: Response) => {
    const { email, password } = req.body;
//TODO if not verified return error

    try {
        // Verificar que el usuario exista en la base de datos
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                wallets: {
                    include: {
                        walletNames: true
                    }
                }
            }
        });
        if (!user) {
            return res.status(401).json({ error: 'User does not exist' });
        }else if(!user.verified){
            const resendToken = jwt.sign(
                { userId: user.id, purpose: 'resend_verification' },
                env.VERIFICATION_RESEND_SECRET,
                { expiresIn: '15m' }
            );
            return res.status(403).json({ error: 'Email not verified. Look your mail inbox.', resendToken });
        }

        // Verificar que la contraseña sea correcta con argon2
        const isPasswordValid = await argon2.verify(user.password, password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Generar un token JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            env.JWT_SECRET,
            { expiresIn: 10000 }
        );
        await updateUserExtraSpace(user);
        // Enviar el token como respuesta
        res.json({ token });
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

const verificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: 'Too many verification requests. Try again later.' },
});

router.post('/send-verification-mail', verificationLimiter, async(req,res)=>{
    const { resendToken } = req.body;

    if (!resendToken || typeof resendToken !== 'string') {
        return res.status(400).json({ message: 'Missing or invalid resendToken' });
    }

    try {
        const decoded = jwt.verify(resendToken, env.VERIFICATION_RESEND_SECRET) as any;

        if (decoded.purpose !== 'resend_verification') {
            return res.status(400).json({ message: 'Invalid token purpose' });
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.verified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }
        await sendVerificationMail(user.id, user.email);
        return res.json({ ok: true });
    } catch (error) {
        if (error instanceof MailDeliveryError) {
            console.error('Resend: verification mail failed:', error);
            return res.status(502).json({
                ok: false,
                message: 'The verification email could not be sent right now. Please try again in a few minutes.',
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ message: 'Resend token expired. Please try logging in again.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ message: 'Invalid resend token' });
        }
        return res.status(500).json({ message: 'Something went wrong' });
    }
});

router.post('/verify', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Token is required.' });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, env.JWT_SECRET);

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

import { Router, Request, Response } from 'express';
import argon2 from 'argon2';
import {MailDeliveryError} from "../services/mailer";
import { InvalidSocialError, normalizeSocial } from '../constants/social-networks';
import { notifyAdminNewUser } from '../services/admin-notify';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { prisma } from '../db';
import { freeHandle } from '../services/public-handle.js';
import { PASSWORD_MIN, normalizeEmail, validateDisplayName, validateHandle } from '../config/profile.js';
import { verifyToken } from '../middleware/authMiddleware';
import { findUserByEmail } from '../services/user-lookup.js';
import {
    AuthTokenError,
    readEmailChange,
    readEmailVerification,
    readPasswordReset,
    signEmailChange,
    signEmailVerification,
    signPasswordReset,
    signSession,
} from '../services/auth-tokens.js';
import { SpentChallenges, createChallenge, verifySolution } from '../services/human-check.js';
import {
    deliver,
    emailChangeMail,
    emailChangedNotice,
    passwordChangedMail,
    passwordResetMail,
    verificationMail,
} from '../services/auth-mails.js';
import { ImageRejected, storeImageBuffer } from './image.js';
import { avatarBuffer } from '../config/avatar-data-url.js';

const router = Router();
import {updateUserExtraSpace, updateWalletNames} from "../services/decentraland-names";

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { message: 'Too many requests. Try again later.' },
});

const humanCheckLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: { message: 'Too many requests. Try again later.' },
});
const spentChallenges = new SpentChallenges();

/** The work the sign-up form has to hand back done. See services/human-check.ts. */
router.get('/human-check', humanCheckLimiter, (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(createChallenge(env.JWT_SECRET));
});

/**
 * Accounts actually created from one address in a day. The check above costs a
 * script milliseconds; this is what costs it something real, because past the
 * limit it needs another IP. Only sign-ups that went through are counted, so
 * typos and retries are free. Twenty leaves room for a workshop on one wifi.
 */
const signUpsPerDay = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 20,
    skipFailedRequests: true,
    message: { error: 'Too many accounts were created from this network today. Try again tomorrow.', code: 'TOO_MANY_ACCOUNTS' },
});

router.post('/register', authLimiter, signUpsPerDay, async (req, res) => {
    const { password, socials, displayName, handle, avatar } = req.body ?? {};

    // Before anything is looked up or stored: no solved challenge, no account.
    // Each one counts once, so a second of work cannot pay for many sign-ups.
    const solved = verifySolution(env.JWT_SECRET, req.body?.humanCheck);
    if (!solved.ok || !spentChallenges.use(solved.id, solved.expiresAt)) {
        const text = 'We could not confirm that you are a person. Please try again.';
        return res.status(400).json({ error: text, message: text, code: 'HUMAN_CHECK_FAILED' });
    }

    // Both `error` and `message` are sent on failures: the Register page reads
    // `error`, while older clients read `message`.
    if (!req.body?.email || !password) {
        return res.status(400).json({ error: 'Email and password are required.', message: 'Email and password are required.' });
    }

    // Stored lower case, so the same inbox can never own two accounts that
    // differ by a capital letter.
    const email = normalizeEmail(req.body.email);
    if (!email) {
        const text = 'That email address is not valid.';
        return res.status(400).json({ error: text, message: text, code: 'EMAIL_INVALID' });
    }

    // The form says so too, but the form is not what protects the account.
    if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
        const text = `The password must be at least ${PASSWORD_MIN} characters.`;
        return res.status(400).json({ error: text, message: text, code: 'PASSWORD_SHORT' });
    }

    const fail = (text: string, code?: string) =>
        res.status(400).json({ error: text, message: text, ...(code ? { code } : {}) });

    try {
        // Check if the user already exists, whatever capitals it was typed with
        const existingUser = await findUserByEmail(email);

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

async function sendVerificationMail(userId: number, email: string) {
    await deliver(email, verificationMail(signEmailVerification(userId, env.JWT_SECRET)));
}

/**
 * Verified against when the address is not ours, so "no such account" costs
 * the same time as "wrong password" and the two cannot be told apart by clock.
 */
let dummyHash: Promise<string> | null = null;
function wasteAHash(password: string): Promise<boolean> {
    dummyHash ??= argon2.hash('not a password anybody has');
    return dummyHash.then((hash) => argon2.verify(hash, password)).catch(() => false);
}

const INVALID_CREDENTIALS = { error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' };

router.post('/login', authLimiter, async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const user = await findUserByEmail(email);

        // One answer for "no such account" and "wrong password". Saying which
        // one it was tells a stranger whose email is registered here.
        if (!user) {
            await wasteAHash(password);
            return res.status(401).json(INVALID_CREDENTIALS);
        }
        if (!await argon2.verify(user.password, password)) {
            return res.status(401).json(INVALID_CREDENTIALS);
        }

        // Only after the password: before it, this answer handed anybody who
        // knew the address a way to make us mail it.
        if (!user.verified) {
            const resendToken = jwt.sign(
                { userId: user.id, purpose: 'resend_verification' },
                env.VERIFICATION_RESEND_SECRET,
                { expiresIn: '15m' }
            );
            return res.status(403).json({ error: 'Email not verified. Look your mail inbox.', code: 'EMAIL_NOT_VERIFIED', resendToken });
        }

        const token = signSession(user, env.JWT_SECRET);

        const withNames = await prisma.user.findUnique({
            where: { id: user.id },
            include: { wallets: { include: { walletNames: true } } },
        });
        if (withNames) await updateUserExtraSpace(withNames as any);

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

const linkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: 'Too many requests. Try again later.' },
});

/** The same two answers for every link we mail: it is wrong (or used), or it is too old. */
function tokenFailure(res: Response, error: unknown) {
    const code = error instanceof AuthTokenError ? error.code : 'TOKEN_INVALID';
    const text = code === 'TOKEN_EXPIRED'
        ? 'This link has expired. Ask for a new one.'
        : 'This link is not valid or has already been used.';
    return res.status(400).json({ error: text, message: text, code });
}

router.post('/verify', linkLimiter, async (req, res) => {
    const { token } = req.body ?? {};

    if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: 'Token is required.' });
    }

    let userId: number;
    try {
        ({ userId } = readEmailVerification(token, env.JWT_SECRET));
    } catch (error) {
        const expired = error instanceof AuthTokenError && error.code === 'TOKEN_EXPIRED';
        return res.status(400).json({ message: expired ? 'Verification token has expired.' : 'Invalid verification token.' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        // The page relies on this exact sentence to treat a second click as success.
        if (user.verified) {
            return res.status(400).json({ message: 'User is already verified.' });
        }

        await prisma.user.update({ where: { id: user.id }, data: { verified: true } });
        return res.json({ message: 'Email has been successfully verified!' });
    } catch (error) {
        console.error('Verification failed: the account could not be updated');
        return res.status(500).json({ message: 'Something went wrong' });
    }
});

// ------------------------------------------------------------ password reset

const forgotLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: 'Too many requests. Try again later.' },
});

/**
 * One reset mail per account every two minutes, whoever asks and from
 * wherever: the limiter above counts per IP, and without this a handful of
 * addresses could still fill somebody's inbox. In memory, which is enough for
 * one process; a restart only forgets a two-minute wait.
 */
const RESET_MAIL_COOLDOWN_MS = 2 * 60 * 1000;
const lastResetMail = new Map<number, number>();
function mayMailReset(userId: number, now = Date.now()): boolean {
    const last = lastResetMail.get(userId);
    if (last !== undefined && now - last < RESET_MAIL_COOLDOWN_MS) return false;
    if (lastResetMail.size > 5000) lastResetMail.clear();
    lastResetMail.set(userId, now);
    return true;
}

router.post('/forgot-password', forgotLimiter, async (req: Request, res: Response) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
        const text = 'That email address is not valid.';
        return res.status(400).json({ error: text, message: text, code: 'EMAIL_INVALID' });
    }

    // Answered before looking anything up: the reply is the same, and just as
    // fast, whether or not that address has an account.
    res.json({ ok: true });

    try {
        const user = await findUserByEmail(email);
        if (!user || !mayMailReset(user.id)) return;
        // To the address on the account, not the one typed: they are the same
        // inbox, but only one of them is ours to trust.
        await deliver(user.email, passwordResetMail(signPasswordReset(user, env.JWT_SECRET)));
    } catch (error) {
        const why = error instanceof MailDeliveryError ? `mail not accepted (${error.code ?? 'no code'})` : 'unexpected error';
        console.error(`Password reset mail failed: ${why}`);
    }
});

function passwordProblem(password: unknown): { text: string; code: string } | null {
    if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
        return { text: `The password must be at least ${PASSWORD_MIN} characters.`, code: 'PASSWORD_SHORT' };
    }
    return null;
}

/** Never awaited by a request: telling the owner is a courtesy, not a step that may fail it. */
function tellOwner(to: string, mail: { subject: string; html: string }) {
    deliver(to, mail).catch(() => console.error(`Account notice not delivered: ${mail.subject}`));
}

router.post('/reset-password', linkLimiter, async (req: Request, res: Response) => {
    const { token, password } = req.body ?? {};
    if (!token || typeof token !== 'string') return tokenFailure(res, null);

    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ error: problem.text, message: problem.text, code: problem.code });

    try {
        const claims = readPasswordReset(token, env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: claims.userId },
            select: { id: true, email: true, password: true },
        });
        if (!user || !claims.matches(user.password)) return tokenFailure(res, null);

        const hashed = await argon2.hash(password);
        // Only if the password is still the one the link was made for: two
        // clicks on the same link cannot both win.
        const changed = await prisma.user.updateMany({
            where: { id: user.id, password: user.password },
            // Reading this mail is the same proof of owning the address that
            // the verification link asks for.
            data: { password: hashed, verified: true },
        });
        if (changed.count === 0) return tokenFailure(res, null);

        tellOwner(user.email, passwordChangedMail());
        res.json({ ok: true });
    } catch (error) {
        if (error instanceof AuthTokenError) return tokenFailure(res, error);
        console.error('Password reset failed with an unexpected error');
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ------------------------------------------------- changes from /account

const accountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many requests. Try again later.' },
});

const WRONG_PASSWORD = { error: 'The current password is not right.', code: 'WRONG_PASSWORD' };

router.post('/change-password', verifyToken, accountLimiter, async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== 'string' || !currentPassword) return res.status(400).json(WRONG_PASSWORD);

    const problem = passwordProblem(newPassword);
    if (problem) return res.status(400).json({ error: problem.text, code: problem.code });

    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, email: true, role: true, password: true },
        });
        // 400, not 401: this is a wrong field in a form, not a dead session.
        if (!user || !await argon2.verify(user.password, currentPassword)) {
            return res.status(400).json(WRONG_PASSWORD);
        }
        if (newPassword === currentPassword) {
            return res.status(400).json({ error: 'The new password is the same as the current one.', code: 'PASSWORD_SAME' });
        }

        const hashed = await argon2.hash(newPassword);
        await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

        // Every session opened with the old password just died, this one
        // included. Hand back a new one so the person who did it stays in.
        const token = signSession({ ...user, password: hashed }, env.JWT_SECRET);
        tellOwner(user.email, passwordChangedMail());
        res.json({ ok: true, token });
    } catch (error) {
        console.error('Password change failed with an unexpected error');
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.post('/change-email', verifyToken, accountLimiter, async (req: Request, res: Response) => {
    const { currentPassword } = req.body ?? {};
    const newEmail = normalizeEmail(req.body?.newEmail);
    if (!newEmail) {
        return res.status(400).json({ error: 'That email address is not valid.', code: 'EMAIL_INVALID' });
    }
    if (typeof currentPassword !== 'string' || !currentPassword) return res.status(400).json(WRONG_PASSWORD);

    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, email: true, password: true },
        });
        if (!user || !await argon2.verify(user.password, currentPassword)) {
            return res.status(400).json(WRONG_PASSWORD);
        }
        if (user.email.toLowerCase() === newEmail) {
            return res.status(400).json({ error: 'That is already your email.', code: 'EMAIL_SAME' });
        }
        // Sign-up already tells anybody whether an address is taken, so saying
        // it here gives nothing new away, and silence would only confuse.
        if (await findUserByEmail(newEmail)) {
            return res.status(400).json({ error: 'That email is already used by another account.', code: 'EMAIL_TAKEN' });
        }

        // Nothing changes yet. The address becomes theirs when the link in
        // that inbox is opened, which is the only proof they can read it.
        try {
            await deliver(newEmail, emailChangeMail(signEmailChange(user, newEmail, env.JWT_SECRET)));
        } catch (mailError) {
            console.error('Email change: confirmation mail not delivered');
            return res.status(502).json({ error: 'The confirmation email could not be sent. Try again in a few minutes.', code: 'MAIL_FAILED' });
        }
        res.json({ ok: true });
    } catch (error) {
        console.error('Email change failed with an unexpected error');
        res.status(500).json({ error: 'Internal server error.' });
    }
});

/** Opened from the mail, possibly in a browser with no session: the token is the proof. */
router.post('/confirm-email-change', linkLimiter, async (req: Request, res: Response) => {
    const { token } = req.body ?? {};
    if (!token || typeof token !== 'string') return tokenFailure(res, null);

    const taken = () => res.status(400).json({ error: 'That email is already used by another account.', code: 'EMAIL_TAKEN' });

    try {
        const claims = readEmailChange(token, env.JWT_SECRET);
        const newEmail = normalizeEmail(claims.newEmail);
        const user = await prisma.user.findUnique({
            where: { id: claims.userId },
            select: { id: true, email: true, password: true },
        });
        if (!user || !newEmail || !claims.matches(user)) return tokenFailure(res, null);

        // Somebody may have registered it in the hour the link was good for.
        const owner = await findUserByEmail(newEmail);
        if (owner && owner.id !== user.id) return taken();

        const changed = await prisma.user.updateMany({
            where: { id: user.id, email: user.email, password: user.password },
            data: { email: newEmail, verified: true },
        });
        if (changed.count === 0) return tokenFailure(res, null);

        // The old address hears about it: if this was not its owner, that
        // mail is the only warning they will get.
        tellOwner(user.email, emailChangedNotice(newEmail));
        res.json({ ok: true, email: newEmail });
    } catch (error) {
        if (error instanceof AuthTokenError) return tokenFailure(res, error);
        if ((error as { code?: string })?.code === 'P2002') return taken();
        console.error('Email change confirmation failed with an unexpected error');
        res.status(500).json({ error: 'Internal server error.' });
    }
});

export default router;

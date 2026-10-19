const expressSession = require('express-session');
const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

function createAuth({ sessionSecret, publicBaseUrl, sendPasswordResetEmail }) {
    let accounts;
    const session = expressSession({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30 }
    });

    function isAuthenticated(req) {
        return Boolean(req.session?.userId);
    }

    function getUserName(req) {
        return req.session?.username || null;
    }

    function getUserId(req) {
        return req.session?.userId || null;
    }

    function requireAuth(req, res, next) {
        if (isAuthenticated(req)) return next();
        return res.status(401).json({ message: 'Log in to use Charma.' });
    }

    function setAccountRepository(repository) {
        accounts = repository;
    }

    function renderAuth(res, options = {}) {
        return res.render('auth', {
            mode: 'login',
            error: null,
            message: null,
            token: '',
            ...options
        });
    }

    function normalize(value) {
        return String(value || '').trim().toLowerCase();
    }

    async function hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const derivedKey = await scrypt(password, salt, 64);
        return `scrypt:${salt}:${derivedKey.toString('hex')}`;
    }

    async function verifyPassword(password, storedHash) {
        const [, salt, expectedHex] = String(storedHash || '').split(':');
        if (!salt || !expectedHex) return false;
        const actual = await scrypt(password, salt, 64);
        const expected = Buffer.from(expectedHex, 'hex');
        return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
    }

    function establishSession(req, account, res) {
        req.session.userId = account.id;
        req.session.username = account.username;
        return req.session.save(error => error
            ? res.status(500).send('Failed to save login session')
            : res.redirect('/'));
    }

    async function register(req, res) {
        const username = normalize(req.body?.username);
        const email = normalize(req.body?.email);
        const password = String(req.body?.password || '');
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username) || !email.includes('@') || password.length < 8) {
            return renderAuth(res, { mode: 'register', error: 'Use a username of 3-30 letters, numbers, or underscores, a valid email, and a password of at least 8 characters.' });
        }
        try {
            const account = await accounts.createAccount({ username, email, passwordHash: await hashPassword(password) });
            return establishSession(req, account, res);
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT') return renderAuth(res, { mode: 'register', error: 'That username or email is already in use.' });
            throw error;
        }
    }

    async function login(req, res) {
        const loginValue = normalize(req.body?.login);
        const password = String(req.body?.password || '');
        const account = await accounts.findByLogin(loginValue);
        if (!account || !(await verifyPassword(password, account.password_hash))) {
            return renderAuth(res, { mode: 'login', error: 'Invalid username/email or password.' });
        }
        return establishSession(req, account, res);
    }

    function logout(req, res) {
        req.session.destroy(() => res.redirect('/'));
    }

    async function requestPasswordReset(req, res) {
        const email = normalize(req.body?.email);
        const account = await accounts.findByLogin(email);
        if (account && account.email === email) {
            const token = crypto.randomBytes(32).toString('hex');
            await accounts.saveResetToken(account.id, crypto.createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 60 * 60 * 1000).toISOString());
            const link = new URL(`/reset-password?token=${token}`, publicBaseUrl).toString();
            await sendPasswordResetEmail({ email, username: account.username, link });
        }
        return renderAuth(res, { mode: 'forgot', message: 'If that email is registered, a password reset link has been sent.' });
    }

    async function resetPassword(req, res) {
        const token = String(req.body?.token || '');
        const password = String(req.body?.password || '');
        const account = await accounts.findByResetToken(crypto.createHash('sha256').update(token).digest('hex'));
        if (!account || password.length < 8) return renderAuth(res, { mode: 'reset', token, error: 'This reset link is invalid or expired, or the password is too short.' });
        await accounts.updatePassword(account.id, await hashPassword(password));
        return renderAuth(res, { mode: 'login', message: 'Password updated. You can now log in.' });
    }

    return { session, isAuthenticated, getUserId, getUserName, requireAuth, setAccountRepository, register, login, logout, requestPasswordReset, resetPassword, renderAuth };
}

module.exports = { createAuth };
const expressSession = require('express-session');
const jwt = require('jsonwebtoken');

function createAuth({ authUrl, callbackBaseUrl, sessionSecret }) {
    const session = expressSession({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, sameSite: 'lax' }
    });

    function isAuthenticated(req) {
        return Boolean(req.session?.formbarToken || req.session?.user);
    }

    function getUserName(req) {
        if (req.session?.formbarUserName) return req.session.formbarUserName;
        if (req.session?.user) {
            return req.session.user.name || req.session.user.displayName || req.session.user.username || null;
        }
        const claims = req.session?.formbarToken ? jwt.decode(req.session.formbarToken) : null;
        return claims?.name || claims?.displayName || claims?.preferred_username || claims?.username || claims?.email || null;
    }

    function getUserId(req) {
        if (req.session?.formbarUserId) return req.session.formbarUserId;
        const claims = req.session?.formbarToken ? jwt.decode(req.session.formbarToken) : null;
        return String(claims?.sub || claims?.id || claims?.userId || claims?.email || getUserName(req) || 'unknown');
    }

    function requireAuth(req, res, next) {
        if (isAuthenticated(req)) return next();
        return res.status(401).json({ message: 'Log in with Formbar to use Charma.' });
    }

    function login(req, res) {
        const returnUrl = `${callbackBaseUrl || `${req.protocol}://${req.get('host')}`}/login/callback`;
        const loginUrl = new URL('/oauth', authUrl);
        loginUrl.searchParams.set('redirectURL', returnUrl);
        return res.redirect(loginUrl.toString());
    }

    function callback(req, res) {
        if (!req.query.token) return res.status(400).send('Missing token in callback');
        req.session.formbarToken = req.query.token;
        req.session.formbarUserId = getUserId({ session: { formbarToken: req.query.token } });
        req.session.formbarUserName = getUserName({ session: { formbarToken: req.query.token } });
        return req.session.save(error => {
            if (error) return res.status(500).send('Failed to save login session');
            return res.redirect('/');
        });
    }

    return { session, isAuthenticated, getUserId, getUserName, requireAuth, login, callback };
}

module.exports = { createAuth };
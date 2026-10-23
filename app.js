require('dotenv').config();

// Require all backend files and installations
const express = require('express');
const path = require('path');
const http = require('http');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');

// Scripts
const initializeDatabase = require('./scripts/initDatabase');
const registerGameActionEndpoint = require('./APIendpoints');
const { createAiService } = require('./backend/aiService');
const { createCombatService } = require('./backend/combatService');
const { createConversationRepository } = require('./backend/conversationRepository');
const { createGameActionService } = require('./backend/gameActions');
const state = require('./backend/gameState');
const { createViewData } = require('./backend/viewData');
const { createAuth } = require('./backend/auth');
const { createAccountRepository } = require('./backend/accountRepository');
const { createAskRouter } = require('./backend/routes/ask');
const { createCombatRouter } = require('./backend/routes/combat');
const { createCourseRouter } = require('./backend/routes/course');
const { createPagesRouter } = require('./backend/routes/pages');
const { loadStoryDocument } = require('./backend/storyDocument');
const { enemies } = require('./enemies/enemyStats');
const { storySpecRewards } = require('./StoryAPI/storySpecRewards');

// Installations
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = Number(process.env.PORT) || 3000;
const serverAddress = process.env.IP_ADDRESS || 'http://localhost';
const ai = createAiService({
    apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4.1-nano'
});
const configuredBaseUrl = process.env.THIS_URL || serverAddress;
const publicBaseUrl = new URL(configuredBaseUrl);
if (!publicBaseUrl.port) publicBaseUrl.port = String(port);

async function sendPasswordResetEmail({ email, username, link }) {
    const providers = [
        {
            name: 'Gmail',
            host: process.env.SMTP_PRIMARY_HOST,
            port: Number(process.env.SMTP_PRIMARY_PORT) || 587,
            secure: process.env.SMTP_PRIMARY_SECURE === 'true',
            user: process.env.SMTP_PRIMARY_USER,
            password: process.env.SMTP_PRIMARY_PASSWORD,
            from: process.env.SMTP_PRIMARY_FROM
        },
        {
            name: 'Microsoft',
            host: process.env.SMTP_BACKUP_HOST,
            port: Number(process.env.SMTP_BACKUP_PORT) || 587,
            secure: process.env.SMTP_BACKUP_SECURE === 'true',
            user: process.env.SMTP_BACKUP_USER,
            password: process.env.SMTP_BACKUP_PASSWORD,
            from: process.env.SMTP_BACKUP_FROM
        }
    ].filter(provider => provider.host && provider.user && provider.password && provider.from);

    if (!providers.length) {
        throw new Error('No SMTP provider is configured. Add Gmail or Microsoft SMTP credentials to .env.');
    }

    let lastError;
    for (const provider of providers) {
        try {
            const transporter = nodemailer.createTransport({
                host: provider.host,
                port: provider.port,
                secure: provider.secure,
                auth: { user: provider.user, pass: provider.password }
            });
            await transporter.sendMail({
                from: provider.from,
                to: email,
                subject: 'Charma password reset',
                text: `Hello ${username},\n\nReset your Charma password using this link:\n${link}\n\nThis link expires in one hour.`
            });
            console.log(`Password reset email sent through ${provider.name}.`);
            return;
        } catch (error) {
            lastError = error;
            console.error(`${provider.name} SMTP failed:`, error.message);
        }
    }

    throw new Error(`All configured SMTP providers failed: ${lastError?.message || 'unknown error'}`);
}

const auth = createAuth({
    publicBaseUrl: publicBaseUrl.origin,
    sessionSecret: process.env.SESSION_SECRET || 'change-this-session-secret',
    sendPasswordResetEmail
});
const combat = createCombatService({
    gameState: state.gameState,
    enemies,
    questionProvider: state.fetchQuestionForCurrentCourse,
    recordCorrectAnswer: state.recordCorrectMasteryAnswer,
    awardExperience: state.addExperience,
    awardBossRushLevel: state.advanceBossRushLevel,
    getProgression: state.getProgression
});

// app.set
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/enemies', express.static(path.join(__dirname, 'enemies')));
app.use(auth.session);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.get('/login', (req, res) => auth.renderAuth(res, { mode: 'login' }));
app.post('/login', auth.login);
app.get('/register', (req, res) => auth.renderAuth(res, { mode: 'register' }));
app.post('/register', auth.register);
app.post('/logout', auth.logout);
app.get('/forgot-password', (req, res) => auth.renderAuth(res, { mode: 'forgot' }));
app.post('/forgot-password', auth.requestPasswordReset);
app.get('/reset-password', (req, res) => auth.renderAuth(res, { mode: 'reset', token: req.query.token || '' }));
app.post('/reset-password', auth.resetPassword);

app.get('/api/ai-status', async (req, res) => {
    const ready = await ai.checkStatus();
    if (!ready) return res.status(503).json({ ready: false, message: 'OpenAI not ready' });
    return res.json({ ready: true, message: 'AI online' });
});
// Socket
io.on('connection', socket => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Database
initializeDatabase()
    .then(async database => {
        try {
            const courses = await state.initializeMasteryCourseSets();
            console.log('Loaded mastery courses:', courses.map(({ id, name }) => ({ id, name })));
        } catch (error) {
            console.error('Unable to load Quizbank mastery courses:', error.message);
        }
        const storyDocument = await loadStoryDocument();
        console.log(storyDocument.length
            ? `Loaded ${storyDocument.length} Markdown story parts.`
            : 'No story parts found; using StoryAPI data only.');
        const conversations = createConversationRepository(database);
        const accounts = createAccountRepository(database);
        auth.setAccountRepository(accounts);
        io.use((socket, next) => auth.session(socket.request, {}, next));
        io.on('connection', async socket => {
            if (!auth.isAuthenticated(socket.request)) return;
            try {
                const account = await accounts.findById(auth.getUserId(socket.request));
                if (!account) return;
                socket.join(`account:${account.id}`);
            } catch (error) {
                console.error('Unable to join account socket room:', error.message);
            }
        });
        app.use(async (req, res, next) => {
            if (!auth.isAuthenticated(req)) return next();
            try {
                const account = await accounts.findById(auth.getUserId(req));
                if (!account) {
                    req.session.destroy(() => {});
                    return res.status(401).json({ message: 'Account no longer exists.' });
                }
                req.accountId = account.id;
                state.loadSnapshot(await accounts.loadState(account.id));
                res.on('finish', () => {
                    const changed = req.method !== 'GET' && req.method !== 'HEAD'
                        && !req.path.startsWith('/auth/') && !req.path.startsWith('/login/');
                    accounts.saveState(account.id, state.getSnapshot()).then(() => {
                        if (changed) {
                            io.to(`account:${account.id}`).emit('account:update', {
                                tools: state.gameState.tools,
                                hp: state.gameState.HP,
                                level: state.getProgression().level,
                                xp: state.getProgression().XP,
                                maxXp: state.getProgression().MAXXP,
                                mastery: state.masteryCourseSets,
                                combat: combat.getSnapshot()
                            });
                        }
                    }).catch(error => console.error('Unable to save account state:', error.message));
                });
                return next();
            } catch (error) {
                return next(error);
            }
        });
        app.use('/api/game', auth.requireAuth);
        registerGameActionEndpoint(app, state.gameState);
        app.post('/api/settings/appearance', auth.requireAuth, async (req, res, next) => {
            try {
                const updated = state.updateAppearance({
                    theme: req.body?.theme,
                    mode: req.body?.mode,
                    panelsHidden: req.body?.panelsHidden
                });
                if (!updated) return res.status(400).json({ success: false, message: 'Invalid appearance setting.' });
                await accounts.saveState(req.accountId, state.getSnapshot());
                return res.json({ success: true, appearance: { ...state.appearance } });
            } catch (error) {
                return next(error);
            }
        });
        app.post('/api/campaign/restart', auth.requireAuth, async (req, res, next) => {
            try {
                await conversations.resetCampaign(req.accountId);
                state.loadSnapshot(null);
                combat.reset();
                await accounts.saveState(req.accountId, state.getSnapshot());
                return res.json({ success: true });
            } catch (error) {
                return next(error);
            }
        });
        app.use('/api/course', auth.requireAuth, createCourseRouter(state, combat));
        app.post('/api/inventory/equip', auth.requireAuth, (req, res) => {
            const result = state.toggleToolEquipped(req.body?.name);
            res.status(result.success ? 200 : 400).json(result);
        });
        const actions = createGameActionService({
            gameState: state.gameState,
            rewards: storySpecRewards,
            enemies,
            startCombat: (enemyName, conversationId) => combat.start(enemyName, conversationId),
            emitInventoryUpdate: tools => io.emit('inventory:update', { tools })
        });
        const viewData = createViewData({ state, combat, conversations, ai });
        app.use('/', createPagesRouter({
            state,
            viewData,
            conversations,
            combat,
            actions,
            accounts,
            isAuthenticated: auth.isAuthenticated,
            getUserName: auth.getUserName
        }));
        app.use('/ask', auth.requireAuth, createAskRouter({ state, conversations, ai, actions, viewData, combat, storyDocument }));
        app.use('/api/combat', auth.requireAuth, createCombatRouter({
            combat,
            ai,
            conversations,
            actions,
            storyDocument,
            getCampaignStats: state.getCampaignStats,
            onBossRushLoss: async accountId => {
                await conversations.resetCampaign(accountId);
                state.loadSnapshot(null);
                combat.reset();
                await accounts.saveState(accountId, state.getSnapshot());
            },
            onCampaignLoss: async accountId => {
                await conversations.resetCampaign(accountId);
                state.loadSnapshot(null);
                combat.reset();
                await accounts.saveState(accountId, state.getSnapshot());
            }
        }));
        server.listen(port, () => {
            console.log(`Server running on ${serverAddress}:${port}`);
        });
    })
    .catch(error => {
        console.error('Database initialization failed:', error.message);
        process.exitCode = 1;
    });
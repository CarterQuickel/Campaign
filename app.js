require('dotenv').config();

// Require all backend files and installations
const express = require('express');
const path = require('path');
const http = require('http');
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
const { enemies } = require('./enemies/enemyStats');
const { storySpecRewards } = require('./StoryAPI/storySpecRewards');

// Installations
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = Number(process.env.PORT) || 3000;
const serverAddress = process.env.IP_ADDRESS || 'http://localhost';
const ai = createAiService({
    baseUrl: process.env.OLLAMA_URL || process.env.AI_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || process.env.AI_MODEL || 'llama3.2:latest'
});
const configuredBaseUrl = process.env.THIS_URL || serverAddress;
const publicBaseUrl = new URL(configuredBaseUrl);
if (!publicBaseUrl.port) publicBaseUrl.port = String(port);
const auth = createAuth({
    authUrl: process.env.AUTH_URL || 'https://formbar.yorktechapps.com',
    callbackBaseUrl: publicBaseUrl.origin,
    sessionSecret: process.env.SESSION_SECRET || 'change-this-session-secret'
});
const combat = createCombatService({
    gameState: state.gameState,
    enemies,
    questionProvider: state.fetchQuestionForCurrentCourse,
    recordCorrectAnswer: state.recordCorrectMasteryAnswer
});

// app.set
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/enemies', express.static(path.join(__dirname, 'enemies')));
app.use(auth.session);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.get('/auth/formbar', auth.login);
app.get('/login/callback', auth.callback);

app.get('/api/ai-status', async (req, res) => {
    const ready = await ai.checkStatus();
    if (!ready) return res.status(503).json({ ready: false, message: 'AI server not ready' });
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
            console.log('Loaded Quizbank mastery courses:', courses.map(({ id, name }) => ({ id, name })));
        } catch (error) {
            console.error('Unable to load Quizbank mastery courses:', error.message);
        }
        const conversations = createConversationRepository(database);
        const accounts = createAccountRepository(database);
        io.use((socket, next) => auth.session(socket.request, {}, next));
        io.on('connection', async socket => {
            if (!auth.isAuthenticated(socket.request)) return;
            try {
                const account = await accounts.ensureAccount(auth.getUserId(socket.request));
                socket.join(`account:${account.id}`);
            } catch (error) {
                console.error('Unable to join account socket room:', error.message);
            }
        });
        app.use(async (req, res, next) => {
            if (!auth.isAuthenticated(req)) return next();
            try {
                const account = await accounts.ensureAccount(auth.getUserId(req));
                req.accountId = account.id;
                state.loadSnapshot(await accounts.loadState(account.id));
                res.on('finish', () => {
                    const changed = req.method !== 'GET' && req.method !== 'HEAD'
                        && !req.path.startsWith('/auth/') && !req.path.startsWith('/login/');
                    accounts.saveState(account.id, state.getSnapshot()).then(() => {
                        if (changed) {
                            io.to(`account:${account.id}`).emit('account:update', {
                                tools: state.gameState.tools,
                                weight: state.gameState.weight,
                                maxWeight: state.gameState.maxWeight,
                                gold: state.gameState.gold,
                                hp: state.gameState.HP,
                                level: state.getProgression().level,
                                xp: state.getProgression().XP,
                                maxXp: state.getProgression().MAXXP
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
        app.use('/api/course', auth.requireAuth, createCourseRouter(state));
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
            isAuthenticated: auth.isAuthenticated,
            getUserName: auth.getUserName
        }));
        app.use('/ask', auth.requireAuth, createAskRouter({ state, conversations, ai, actions, viewData, combat }));
        app.use('/api/combat', auth.requireAuth, createCombatRouter({ combat, ai, conversations, actions }));
        server.listen(port, () => {
            console.log(`Server running on ${serverAddress}:${port}`);
        });
    })
    .catch(error => {
        console.error('Database initialization failed:', error.message);
        process.exitCode = 1;
    });
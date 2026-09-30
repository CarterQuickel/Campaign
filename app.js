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
const ai = createAiService();
const combat = createCombatService({ gameState: state.gameState, enemies });

// app.set
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/enemies', express.static(path.join(__dirname, 'enemies')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// APIs
registerGameActionEndpoint(app, state.gameState);
app.use('/api/combat', createCombatRouter(combat));
app.use('/api/course', createCourseRouter(state));
app.get('/api/ai-status', async (req, res) => {
    const ready = await ai.checkStatus();
    if (!ready) return res.status(503).json({ ready: false, message: 'AI server not ready' });
    return res.json({ ready: true, message: 'AI online' });
});
const { toggleToolEquipped } = require('./backend/gameState');
app.post('/api/inventory/equip', (req, res) => {
    const result = toggleToolEquipped(req.body?.name);
    res.status(result.success ? 200 : 400).json(result);
});

// Socket
io.on('connection', socket => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Database
initializeDatabase()
    .then(database => {
        const conversations = createConversationRepository(database);
        const actions = createGameActionService({
            gameState: state.gameState,
            rewards: storySpecRewards,
            emitInventoryUpdate: tools => io.emit('inventory:update', { tools })
        });
        const viewData = createViewData({ state, combat, conversations, ai });
        app.use('/', createPagesRouter({ state, viewData, conversations }));
        app.use('/ask', createAskRouter({ state, conversations, ai, actions, viewData }));
        server.listen(port, () => console.log(`Server running on ${serverAddress}:${port}`));
    })
    .catch(error => {
        console.error('Database initialization failed:', error.message);
        process.exitCode = 1;
    });
const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = process.env.PORT || 3000;
const systemAPI = require('./APIendpoints.js');
const tools = require('./StoryAPI/tools.js').Tools;
const database = new sqlite3.Database('./chat-history.db');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const IP_ADDRESS = process.env.IP_ADDRESS || 'http://localhost';
const AUTH_URL = process.env.AUTH_URL || 'https://formbar.yorktechapps.com';
const THIS_URL = process.env.THIS_URL || 'http://localhost:3000/login';
const PORT = process.env.PORT || 3000;

const gameState = {
    gold: 0,
    tools: tools.map(tool => ({ ...tool })),
    charName: "Carter",
    charClass: "Druid",
    charRace: "Elvish",
    charOrigin: ""
};
let stats = [
    10, 3, 10, 15, 7, 14
]
let level = 3;
let mastery = [
    {
        name: 'General Information and Concepts',
        completion: 24,
        color: '#f1ece2',
        current: false
    },
    {
        name: 'Ethics, Legal Compliance, and Security',
        completion: 87,
        color: '#6b625e',
        current: false
    },
    {
        name: 'Analyze Programming Problems, Manage Projects, and Create Flowchart Solutions',
        completion: 54,
        color: '#b8cfd0',
        current: true
    },
    {
        name: 'Design Program Solutions',
        completion: 12,
        color: '#5a617a',
        current: false
    },
    {
        name: 'Code Programs',
        completion: 67,
        color: '#828e6f',
        current: false
    },
    {
        name: 'Test Programs',
        completion: 24,
        color: '#5d5f37',
        current: false
    },
    {
        name: 'Maintain Programs and Implement Change Management Procedures',
        completion: 19,
        color: '#d3a7a8',
        current: false
    },
    {
        name: 'Complete User Documentation and Technical Writing',
        completion: 62,
        color: '#b1756a',
        current: false
    }
]

// Run the database
database.run(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);
database.run('ALTER TABLE messages ADD COLUMN conversation_id INTEGER', () => { });
database.run(`
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);
database.run(`
    CREATE TABLE IF NOT EXISTS claimed_rewards (
        reward_id TEXT PRIMARY KEY,
        claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Function to get recent messages from the database
function getRecentMessages(conversationId, limit = 20) {
    return new Promise((resolve, reject) => {
        database.all(
            'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?',
            [conversationId, limit],
            (error, rows) => error ? reject(error) : resolve(rows.reverse())
        );
    });
}

// Default message
function addDefaultAiMessage(messages, displayName) {
    const defaultAiMessage = {
        role: 'assistant',
        content: `Welcome, adventurer ${displayName || ""}. I am Charma, your personal AI dungeon master. How would you like to begin your journey?`
    };
    return [defaultAiMessage, ...messages];
}

// Function to save a message to the database
function saveMessage(conversationId, role, content) {
    return new Promise((resolve, reject) => {
        database.run(
            'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
            [conversationId, role, content],
            error => error ? reject(error) : resolve()
        );
    });
}
function getConversations() {
    return new Promise((resolve, reject) => {
        database.all(
            'SELECT id, title FROM conversations ORDER BY id DESC',
            (error, rows) => error ? reject(error) : resolve(rows)
        );
    });
}
function createConversation(title) {
    return new Promise((resolve, reject) => {
        database.run(
            'INSERT INTO conversations (title) VALUES (?)',
            [title],
            function (error) { error ? reject(error) : resolve(this.lastID); }
        );
    });
}
async function getConversationTitle(prompt) {
    const convoNamer = require('./convoNamer.js').convoNamer;
    const ollamaTitle = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'llama3.2',
            prompt: `Create a title for this quest or conversation:\n${prompt}`,
            system: convoNamer,
            options: { temperature: 0.2, num_predict: 12 },
            stream: false
        })
    });
    const titleData = await ollamaTitle.json();
    if (!ollamaTitle.ok) {
        throw new Error(titleData.error || `AI server returned HTTP ${ollamaTitle.status}`);
    }
    return titleData.response
        .trim()
        .split(/\r?\n/)[0]
        .replace(/^[*#\"']+|[*#\"']+$/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .join(' ');
}

//======================================================================================================================//

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); // Allows reading form data
app.use(express.json());
systemAPI(app, gameState);

//formbar stuff

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: false
}));

app.use((req, res, next) => {
    const FID = req.session && req.session.user && (req.session.user.fid || req.session.user.FID) ? Number(req.session.user.fid || req.session.user.FID) : null;
    next();
});

function isAuthenticated(req, res, next) {
    if (req.session.formbarToken) {
        return next();
    }

    const callbackUrl = `${IP_ADDRESS}:${PORT}/login/callback`;

    const loginUrl = new URL('/oauth', AUTH_URL);
    loginUrl.searchParams.set('redirectURL', callbackUrl);

    res.redirect(loginUrl.toString());
}

app.get('/login/callback', (req, res) => {
    if (!req.query.token) {
        return res.status(400).send('Missing token in callback');
    }

    // SAVE THE Formbar TOKEN
    req.session.formbarToken = req.query.token;

    const decoded = jwt.decode(req.query.token);
    console.log('Decoded token:', decoded);

    req.session.user = decoded;

    // Save session before redirecting
    req.session.save((err) => {
        if (err) {
            console.error('Failed to save session:', err);
            return res.status(500).send('Failed to save login session');
        }

        res.redirect('/');
    });
});

// Game action parsing
function parseGameActionFromText(responseText) {
    if (typeof responseText !== 'string') {
        return null;
    }
    const text = responseText.trim();
    const tagMatch = text.match(/<ACTION>\s*([\s\S]*?)\s*<\/ACTION>/i);
    if (tagMatch) {
        try {
            const parsed = JSON.parse(tagMatch[1]);
            if (parsed && parsed.name === 'give_gold') {
                return { name: 'give_gold', amount: Number(parsed.amount ?? parsed.gold_amount ?? 0) };
            }
        } catch (error) {
            console.error('Could not parse game action tag:', error.message);
        }
    }
    const directJsonMatch = text.match(/\{\s*"name"\s*:\s*"give_gold"\s*,\s*"amount"\s*:\s*(\d+)\s*\}/i);
    if (directJsonMatch) {
        return { name: 'give_gold', amount: Number(directJsonMatch[1]) };
    }
    const giveGoldFnMatch = text.match(/give_gold\s*\(\s*(\d+)\s*\)/i);
    if (giveGoldFnMatch) {
        return { name: 'give_gold', amount: Number(giveGoldFnMatch[1]) };
    }
    const inlineAmountMatch = text.match(/(?:reward|gave|grant|awarded?)\s+(\d+)\s*(?:gp|gold)/i);
    if (inlineAmountMatch) {
        return { name: 'give_gold', amount: Number(inlineAmountMatch[1]) };
    }
    return null;
}

// Game action applying
function applyActionFromText(responseText) {
    if (typeof responseText !== 'string') {
        return responseText;
    }
    const action = parseGameActionFromText(responseText);
    if (!action) {
        return responseText;
    }
    if (action.name === 'give_gold') {
        const amount = Number(action.amount ?? 0);
        if (Number.isFinite(amount) && amount !== 0) {
            gameState.gold = (Number(gameState.gold) || 0) + amount;
        }
    }
    const cleanedText = responseText
        .replace(/<ACTION>[\s\S]*?<\/ACTION>/gi, '')
        .replace(/\{\s*"name"\s*:\s*"give_gold"\s*,\s*"amount"\s*:\s*\d+\s*\}/gi, '')
        .replace(/give_gold\s*\(\s*\d+\s*\)/gi, '')
        .replace(/(?:reward|gave|grant|awarded?)\s+\d+\s*(?:gp|gold)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleanedText) {
        return cleanedText;
    }
    if (action.name === 'give_gold') {
        return `You receive ${action.amount} gold.`;
    }
    return responseText.trim();
}

// Get Quizbank API
app.get('/api/course/:id/mastery', async (req, res) => {
    const courseId = req.params.id;
    const studentId = req.query.studentId;

    try {
        if (!req.session.formbarApiKey) {
            return res.status(401).json({
                error: 'Formbar API key not available'
            });
        }

        const quizbankUrl =
            `https://quizbank.yorktechapps.com/api/course/${courseId}/mastery?studentId=${encodeURIComponent(studentId)}`;

        console.log('Fetching from:', quizbankUrl);
        console.log('Course ID:', courseId);
        console.log('Student ID:', studentId);

        const upstreamResponse = await fetch(quizbankUrl, {
            headers: {
                api: req.session.formbarApiKey
            }
        });

        const text = await upstreamResponse.text();

        if (!upstreamResponse.ok) {
            console.error('Quizbank response:', text);

            return res.status(upstreamResponse.status).json({
                error: 'Failed to fetch course data',
                upstreamStatus: upstreamResponse.status,
                upstreamResponse: text
            });
        }

        let data;

        try {
            data = JSON.parse(text);
        } catch (error) {
            return res.status(502).json({
                error: 'Course API returned an invalid response'
            });
        }

        if (!Array.isArray(data.units)) {
            return res.status(404).json({
                error: 'No units found for this course',
                courseId
            });
        }

        return res.json(data.units);

    } catch (error) {
        console.error('Course fetch error:', error);

        return res.status(500).json({
            error: 'Failed to load course data',
            details: error.message
        });
    }
}); f

// Get AI online or offline
let online = false;
async function checkAiStatus() {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) {
            online = false;
            return false;
        }
        const data = await response.json();
        online = Array.isArray(data.models) && data.models.length > 0;
        return online;
    } catch (error) {
        online = false;
        return false;
    }
}
app.get('/api/ai-status', async (req, res) => {
    const isReady = await checkAiStatus();
    if (!isReady) {
        return res.status(503).json({ ready: false, message: 'AI server not ready' });
    }
    return res.json({ ready: true, message: 'AI online' });
});

// Render the initial page with a welcome message
app.get('/', isAuthenticated, async (req, res) => {
    const aiReady = await checkAiStatus();
    res.render('index',
        {
            response: null,
            prompt: null,
            conversations: await getConversations(),
            conversationId: null,
            messages: addDefaultAiMessage([], req.session && req.session.user ? req.session.user.displayName : null),
            online: aiReady,
            stats: stats,
            tools: tools,
            mastery: mastery,
            level: level,
            gold: gameState.gold,
            req: req.session ? req.session.user : null,
            charData: {
                name: gameState.charName,
                class: gameState.charClass,
                race: gameState.charRace,
                origin: gameState.charOrigin,
            }
        });
});

// Other pages
app.get('/mastery', async (req, res) => {
    const aiReady = await checkAiStatus();
    res.render('mastery', {
        stats: stats,
        online: aiReady,
        tools: tools,
        mastery: mastery,
        level: level,
        gold: gameState.gold,
        req: req.session ? req.session.user : null,
        charData: {
            name: gameState.charName,
            class: gameState.charClass,
            race: gameState.charRace,
            origin: gameState.charOrigin
        }
    });
});

app.post('/updateSheet', async (req, res) => {
    const cName = req.body.name;
    const cOrigin = req.body.origin;
    const cRace = req.body.race;
    const cClass = req.body.class;
    try {
        gameState.charName = cName;
        gameState.charClass = cClass;
        gameState.charRace = cRace;
        gameState.charOrigin = cOrigin;
        console.log(gameState);
        res.redirect('/');
    } catch (err) {
        console.log("Character Sheet Saving Error: ", err);
    }
});

// Handle the form submission and call Ollama
app.post('/ask', async (req, res) => {
    const userPrompt = req.body.prompt;
    try {
        const system = require('./system.js').system;
        const storySpecRewards = require('./StoryAPI/storySpecRewards').storySpecRewards;
        const landmarks = require('./StoryAPI/landmarks').landmarks;
        const stories = require('./StoryAPI/stories').stories;
        const storyContext = {
            stories,
            landmarks,
            storySpecRewards
        };
        let conversationId = Number(req.body.conversationId) || null;
        if (!conversationId) {
            const title = await getConversationTitle(userPrompt);
            conversationId = await createConversation(title);
        }
        const history = await getRecentMessages(conversationId);
        await saveMessage(conversationId, 'user', userPrompt);
        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.2',
                prompt: [
                    `You are a helpful assistant. Use the conversation history when it is relevant.
                    Use the following StoryAPI data as the source of truth for the adventure:
                    ${JSON.stringify(storyContext, null, 2)}

                    If a story, landmark, reward, or story hook matches the current scene, incorporate it naturally and keep the world consistent with the provided data.
                    `,
                    ...history.map(message => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`),
                    `User: ${userPrompt}`,
                    'Assistant:',
                ].join('\n\n'),
                system: system,
                stream: false
            })
        });
        const data = await ollamaResponse.json();
        if (!ollamaResponse.ok) {
            throw new Error(data.error || `AI server returned HTTP ${ollamaResponse.status}`);
        }
        const cleanedResponse = applyActionFromText(data.response);
        await saveMessage(conversationId, 'assistant', cleanedResponse || data.response);
        const messages = addDefaultAiMessage(await getRecentMessages(conversationId), req.session && req.session.user ? req.session.user.displayName : null);
        const aiReady = await checkAiStatus();
        res.render('index', {
            response: cleanedResponse || data.response,
            prompt: userPrompt,
            conversations: await getConversations(),
            conversationId,
            messages,
            online: aiReady,
            stats: stats,
            tools: tools,
            mastery: mastery,
            level: level,
            gold: gameState.gold,
            charData: {
                name: gameState.charName,
                class: gameState.charClass,
                race: gameState.charRace,
                origin: gameState.charOrigin
            }
        });
    } catch (error) {
        console.error("Ollama Error:", error);
        const conversationId = Number(req.body.conversationId) || null;
        const messages = addDefaultAiMessage(conversationId ? await getRecentMessages(conversationId) : [], req.session && req.session.user ? req.session.user.displayName : null);
        const aiReady = await checkAiStatus();
        res.render('index', {
            response: `AI request failed: ${error.message}`,
            prompt: userPrompt,
            conversations: await getConversations(),
            conversationId,
            messages,
            online: aiReady,
            stats: stats,
            tools: tools,
            mastery: mastery,
            level: level,
            gold: gameState.gold,
            charData: {
                name: gameState.charName,
                class: gameState.charClass,
                race: gameState.charRace,
                origin: gameState.charOrigin
            }
        });
    }
});

// Get localhost
app.listen(PORT, () => console.log(`Server running on ${IP_ADDRESS}:${PORT}`));

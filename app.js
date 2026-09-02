const express= require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3000;
const database = new sqlite3.Database('./chat-history.db');
let stats = [
    10, 3, 10, 15, 7, 14
]
const tools = require('./StoryAPI/tools.js').Tools;

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

database.run('ALTER TABLE messages ADD COLUMN conversation_id INTEGER', () => {});

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

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); // Allows reading form data
app.use(express.json());

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

// Render the initial blank page
app.get('/', async (req, res) => {
    const aiReady = await checkAiStatus();
    res.render('index', 
        { response: null, prompt: null, conversations: await getConversations(), conversationId: null, messages: [], online: aiReady, stats: stats, tools: tools });
});

app.post('/api/rewards/claim', (req, res) => {
    const rewardId = typeof req.body.rewardId === 'string' ? req.body.rewardId.trim() : '';
    if (!rewardId) {
        return res.status(400).json({ success: false, error: 'A reward ID is required.' });
    }

    database.run(
        'INSERT OR IGNORE INTO claimed_rewards (reward_id) VALUES (?)',
        [rewardId],
        error => {
            if (error) {
                console.error('Reward claim failed:', error);
                return res.status(500).json({ success: false, error: 'The reward could not be claimed.' });
            }
            res.json({ success: true });
        }
    );
});

// Handle the form submission and call Ollama
app.post('/ask', async (req, res) => {
    const userPrompt = req.body.prompt;
    try {
        const system = require('./system.js').system;
        const rewards = require('./StoryAPI/rewards.js').rewards;
        const storySpecRewards = require('./StoryAPI/storySpecRewards').storySpecRewards;
        const landmarks = require('./StoryAPI/landmarks').landmarks;
        const stories = require('./StoryAPI/stories').stories;
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
                    You must use this story: ${stories} with these random landmarks: ${landmarks}
                    and these story rewards: ${storySpecRewards} but also use these general rewards: ${rewards}.`,
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
        await saveMessage(conversationId, 'assistant', data.response);
        const messages = await getRecentMessages(conversationId);
        const aiReady = await checkAiStatus();
        res.render('index', { 
            response: data.response, 
            prompt: userPrompt, 
            conversations: await getConversations(),
            conversationId,
            messages, 
            online: aiReady,
            stats: stats,
            tools: tools
        });
    } catch (error) {
        console.error("Ollama Error:", error);
        const conversationId = Number(req.body.conversationId) || null;
        const messages = conversationId ? await getRecentMessages(conversationId) : [];
        const aiReady = await checkAiStatus();
        res.render('index', { 
            response: `AI request failed: ${error.message}`,
            prompt: userPrompt,
            conversations: await getConversations(),
            conversationId,
            messages,
            online: aiReady,
            stats: stats,
            tools: tools
        });
    }
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

const express= require('express');
const env = require('dotenv').config();
const initializeDatabase = require('./scripts/initDatabase');
const app = express();
const port = 3000;
const IP = process.env.IP_ADDRESS || 'localhost';
const systemAPI = require('./APIendpoints.js');
const tools = require('./StoryAPI/tools.js').Tools;
const classHP = require('./healthCalc.js').classHP;
let database;
let stats = [
    10, 3, 20, 15, 7, 14
];
let campaignClass = "Barbarian";
let level = 20;
const HP_equation = (classHP.find(c => c.name === campaignClass)?.default + ((stats[2] - 10) / 2)) + (((level - 1) * ((stats[2] - 10) / 2)) + ((level - 1) * (classHP.find(c => c.name === campaignClass)?.perLevel)))
const gameState = {
    gold: 0,
    tools: tools.map(tool => ({ ...tool })),
    charName: "Carter",
    charClass: campaignClass,
    charRace: "Elvish",
    charOrigin: "",
    HP: HP_equation
};
console.log(gameState.HP);
let mastery = {
    "Computer Programming NOCTI": [
        { name: 'General Information and Concepts', completion: 24, color: '#f1ece2', current: false },
        { name: 'Ethics, Legal Compliance, and Security', completion: 87, color: '#6b625e', current: false },
        { name: 'Analyze Programming Problems, Manage Projects, and Create Flowchart Solutions', completion: 54, color: '#b8cfd0', current: false },
        { name: 'Design Program Solutions', completion: 12, color: '#5a617a', current: false },
        { name: 'Code Programs', completion: 67, color: '#828e6f', current: true },
        { name: 'Test Programs', completion: 24, color: '#5d5f37', current: false },
        { name: 'Maintain Programs and Implement Change Management Procedures', completion: 19, color: '#d3a7a8', current: false },
        { name: 'Complete User Documentation and Technical Writing', completion: 62, color: '#b1756a', current: false }
    ],
    "CIW Javascript Specialist": [
        { name: 'Introduction to JavaScript', completion: 0, color: '#1a1a1a', current: false },
        { name: 'Working with Variables and Data in JavaScript', completion: 10, color: '#2b2b2b', current: false },
        { name: 'Functions, Methods, and Events in JavaScript', completion: 90, color: '#3c3c3c', current: false },
        { name: 'Debugging and Troubleshooting in JavaScript', completion: 15, color: '#4d4d4d', current: false },
        { name: 'Controlling Program Flow in JavaScript', completion: 0, color: '#5e5e5e', current: false },
        { name: 'The JavaScript Document Object Model (DOM)', completion: 0, color: '#6f6f6f', current: false },
        { name: 'JavaScript Language Objects', completion: 8, color: '#7a7a7a', current: false },
        { name: 'Custom JavaScript Objects', completion: 100, color: '#8b8b8b', current: false },
        { name: 'Changing HTML on the Fly', completion: 5, color: '#7a6f6f', current: false },
        { name: 'Developing Interactive Forms with JavaScript', completion: 98, color: '#635050', current: false },
        { name: 'JavaScript Security', completion: 12, color: '#614b4b', current: false },
        { name: 'JavaScript Libraries and Frameworks', completion: 38, color: '#746767', current: false },
        { name: 'JavaScript and AJAX', completion: 19, color: '#615252', current: false },
        { name: 'Introduction to Web APIs', completion: 70, color: '#4b3d3d', current: false }
    ]
};

const masteryCourseSets = Object.entries(mastery).map(([name, sections]) => ({
    name,
    sections
}));

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
function addDefaultAiMessage(messages) {
    const defaultAiMessage = {
        role: 'assistant',
        content: `Welcome, adventurer ${gameState.charName}. I am Charma, your personal AI dungeon master. How would you like to begin your journey?`
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
    const ollamaTitle = await fetch(`http://localhost:11434/api/generate`, {
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
app.get('/api/course/:id', async (req, res) => {
    const courseId = req.params.id;
    try {
        const upstreamResponse = await fetch(`https://quizbank.yorktechapps.com/api/course/${courseId}`);
        const text = await upstreamResponse.text();
        if (!upstreamResponse.ok) {
            return res.status(upstreamResponse.status).send(text || 'Failed to fetch course data');
        }
        const data = JSON.parse(text);
        if (!Array.isArray(data.units)) {
            return res.status(404).json({
                error: 'No units found for this course',
                courseId
            });
        }
        console.log(data.units, data.tasks);
        return res.json(data.units);
    } catch (error) {
        console.error('Course fetch error:', error);
        return res.status(500).json({
            error: 'Failed to load course data',
            details: error.message
        });
    }
});

// Get AI online or offline
let online = false;
async function checkAiStatus() {
    try {
        const response = await fetch(`http://localhost:11434/api/tags`);
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
app.get('/', async (req, res) => {
    const aiReady = await checkAiStatus();
    res.render('index', 
    { 
        response: null, 
        prompt: null, 
        conversations: await getConversations(), 
        conversationId: null, 
        messages: addDefaultAiMessage([]), 
        online: aiReady, 
        stats: stats, 
        tools: tools, 
        mastery: masteryCourseSets, 
        gold: gameState.gold,
        level: level,
        charData: { 
            name: gameState.charName, 
            class: gameState.charClass, 
            race: gameState.charRace, 
            origin: gameState.charOrigin,
            HP: gameState.HP
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
        mastery: masteryCourseSets,
        gold: gameState.gold,
        level: level,
        charData: { 
            name: gameState.charName, 
            class: gameState.charClass, 
            race: gameState.charRace, 
            origin: gameState.charOrigin,
            HP: gameState.HP
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
        gameState.HP = classHP.find(c => c.name === cClass)?.default + ((level - 1) * classHP.find(c => c.name === cClass)?.perLevel)
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
        const ollamaResponse = await fetch(`http://localhost:11434/api/generate`, {
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
        const messages = addDefaultAiMessage(await getRecentMessages(conversationId));
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
            mastery: masteryCourseSets, 
            gold: gameState.gold,
            level: level,
            charData: { 
                name: gameState.charName, 
                class: gameState.charClass, 
                race: gameState.charRace, 
                origin: gameState.charOrigin,
                HP: gameState.HP
            } 
        });
    } catch (error) {
        console.error("Ollama Error:", error);
        const conversationId = Number(req.body.conversationId) || null;
        const messages = addDefaultAiMessage(conversationId ? await getRecentMessages(conversationId) : []);
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
            mastery: masteryCourseSets, 
            gold: gameState.gold,
            level: level,
            charData: { 
                name: gameState.charName, 
                class: gameState.charClass, 
                race: gameState.charRace, 
                origin: gameState.charOrigin,
                HP: gameState.HP
            } 
        });
    }
});

// Get localhost
initializeDatabase()
    .then((initializedDatabase) => {
        database = initializedDatabase;
        app.listen(port, () => console.log(`Server running on http://${IP}:${port}`));
    })
    .catch((error) => {
        console.error('Database initialization failed:', error.message);
        process.exitCode = 1;
    });

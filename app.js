const express= require('express');
const sqlite3 = require('sqlite3').verbose();
// If using CommonJS, use: const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
const database = new sqlite3.Database('./chat-history.db');

database.run(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

function getRecentMessages(limit = 20) {
    return new Promise((resolve, reject) => {
        database.all(
            'SELECT role, content FROM messages ORDER BY id DESC LIMIT ?',
            [limit],
            (error, rows) => error ? reject(error) : resolve(rows.reverse())
        );
    });
}

function saveMessage(role, content) {
    return new Promise((resolve, reject) => {
        database.run(
            'INSERT INTO messages (role, content) VALUES (?, ?)',
            [role, content],
            error => error ? reject(error) : resolve()
        );
    });
}

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); // Allows reading form data
app.use(express.json());

// 1. Render the initial blank page
app.get('/', (req, res) => {
    res.render('index', { response: null, prompt: null });
});

// 2. Handle the form submission and call Ollama
app.post('/ask', async (req, res) => {
    const userPrompt = req.body.prompt;

    try {
        const system = require('./system.js').system; // Import the system prompt
        const history = await getRecentMessages();
        await saveMessage('user', userPrompt);

        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.2', // Ensure you pulled this model first
                prompt: [
                    'You are a helpful assistant. Use the conversation history when it is relevant.',
                    ...history.map(message => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`),
                    `User: ${userPrompt}`,
                    'Assistant:'
                ].join('\n\n'),
                system: system,
                stream: false      // Disables streaming for simpler EJS rendering
            })
        });

        const data = await ollamaResponse.json();

        if (!ollamaResponse.ok) {
            throw new Error(data.error || `AI server returned HTTP ${ollamaResponse.status}`);
        }

        await saveMessage('assistant', data.response);
        
        // Render the page again, passing the data back to EJS
        res.render('index', { 
            response: data.response, 
            prompt: userPrompt 
        });

    } catch (error) {
        console.error("Ollama Error:", error);
        res.render('index', { 
            response: `AI request failed: ${error.message}`,
            prompt: userPrompt 
        });
    }
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

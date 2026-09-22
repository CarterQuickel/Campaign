const express = require('express');
const systemAPI = require('../APIendpoints.js');
const { classHP } = require('../healthCalc.js');
const { addDefaultAiMessage, getConversationTitle, checkAiStatus, applyActionFromText } = require('./ai');
const { getRecentMessages, saveMessage, getConversations, createConversation } = require('./database');
const { calculateHP } = require('./appState');

function buildRenderContext(state, overrides = {}) {
    return {
        stats: state.stats,
        tools: state.tools,
        mastery: state.mastery,
        gold: state.gold,
        level: state.level,
        online: overrides.online ?? false,
        conversations: overrides.conversations ?? [],
        conversationId: overrides.conversationId ?? null,
        messages: overrides.messages ?? [],
        response: overrides.response ?? null,
        prompt: overrides.prompt ?? null,
        charData: {
            name: state.charName,
            class: state.charClass,
            race: state.charRace,
            origin: state.charOrigin,
            HP: state.HP
        }
    };
}

function registerRoutes(app, { database, state }) {
    app.set('view engine', 'ejs');
    app.use(express.static('public'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    systemAPI(app, state);

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

    app.get('/api/ai-status', async (req, res) => {
        const isReady = await checkAiStatus();
        if (!isReady) {
            return res.status(503).json({ ready: false, message: 'AI server not ready' });
        }
        return res.json({ ready: true, message: 'AI online' });
    });

    app.get('/', async (req, res) => {
        const aiReady = await checkAiStatus();
        const conversations = await getConversations(database);
        res.render('index', {
            ...buildRenderContext(state, {
                online: aiReady,
                conversations,
                messages: addDefaultAiMessage(state, [])
            })
        });
    });

    app.get('/mastery', async (req, res) => {
        const aiReady = await checkAiStatus();
        res.render('mastery', {
            ...buildRenderContext(state, { online: aiReady })
        });
    });

    app.post('/updateSheet', async (req, res) => {
        const cName = req.body.name;
        const cOrigin = req.body.origin;
        const cRace = req.body.race;
        const cClass = req.body.class;
        try {
            state.charName = cName;
            state.charClass = cClass;
            state.charRace = cRace;
            state.charOrigin = cOrigin;
            state.HP = calculateHP(cClass, state.stats, state.level);
            res.redirect('/');
        } catch (err) {
            console.log('Character Sheet Saving Error: ', err);
        }
    });

    app.post('/ask', async (req, res) => {
        const userPrompt = req.body.prompt;
        try {
            const system = require('../system.js').system;
            const storySpecRewards = require('../StoryAPI/storySpecRewards').storySpecRewards;
            const landmarks = require('../StoryAPI/landmarks').landmarks;
            const stories = require('../StoryAPI/stories').stories;
            const storyContext = { stories, landmarks, storySpecRewards };
            let conversationId = Number(req.body.conversationId) || null;
            if (!conversationId) {
                const title = await getConversationTitle(userPrompt);
                conversationId = await createConversation(database, title);
            }
            const history = await getRecentMessages(database, conversationId);
            await saveMessage(database, conversationId, 'user', userPrompt);

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
                        'Assistant:'
                    ].join('\n\n'),
                    system,
                    stream: false
                })
            });

            const data = await ollamaResponse.json();
            if (!ollamaResponse.ok) {
                throw new Error(data.error || `AI server returned HTTP ${ollamaResponse.status}`);
            }

            const cleanedResponse = applyActionFromText(data.response, state);
            await saveMessage(database, conversationId, 'assistant', cleanedResponse || data.response);
            const messages = addDefaultAiMessage(state, await getRecentMessages(database, conversationId));
            const aiReady = await checkAiStatus();
            const conversations = await getConversations(database);

            res.render('index', {
                ...buildRenderContext(state, {
                    online: aiReady,
                    conversations,
                    conversationId,
                    messages,
                    response: cleanedResponse || data.response,
                    prompt: userPrompt
                })
            });
        } catch (error) {
            console.error('Ollama Error:', error);
            const conversationId = Number(req.body.conversationId) || null;
            const messages = addDefaultAiMessage(state, conversationId ? await getRecentMessages(database, conversationId) : []);
            const aiReady = await checkAiStatus();
            const conversations = await getConversations(database);

            res.render('index', {
                ...buildRenderContext(state, {
                    online: aiReady,
                    conversations,
                    conversationId,
                    messages,
                    response: `AI request failed: ${error.message}`,
                    prompt: userPrompt
                })
            });
        }
    });
}

module.exports = {
    registerRoutes,
    buildRenderContext
};

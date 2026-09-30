const express = require('express');
const { system } = require('../../system');
const { stories } = require('../../StoryAPI/stories');
const { landmarks } = require('../../StoryAPI/landmarks');
const { storySpecRewards } = require('../../StoryAPI/storySpecRewards');
const { enemies } = require('../../enemies/enemyStats');

// Initial root directory
function createAskRouter({ state, conversations, ai, actions, viewData }) {
    const router = express.Router();
    router.post('/', async (req, res, next) => {
        const userPrompt = req.body.prompt;
        let conversationId = Number(req.body.conversationId) || null;
        try {
            if (!conversationId) {
                const title = await ai.createTitle(userPrompt);
                conversationId = await conversations.createConversation(title);
            }
            const history = await conversations.getRecentMessages(conversationId);
            await conversations.saveMessage(conversationId, 'user', userPrompt);
            const storyContext = {
                stories,
                landmarks,
                storySpecRewards,
                availableItems: state.gameState.tools.map(item => item.name),
                enemies: enemies.map(enemy => enemy.name)
            };
            const responseText = await ai.generateReply({ userPrompt, history, system, storyContext });
            const finalResponse = (actions.apply(responseText, { conversationId }) || responseText).trim();
            await conversations.saveMessage(conversationId, 'assistant', finalResponse);
            const messages = await conversations.getRecentMessages(conversationId);
            messages.unshift({
                role: 'assistant',
                content: `Welcome, adventurer ${state.gameState.charName}. I am Charma, your personal AI dungeon master. How would you like to begin your journey?`
            });
            res.render('index', await viewData.buildIndexData({
                req, response: finalResponse, prompt: userPrompt, conversationId, messages
            }));
        } catch (error) {
            console.error('Ollama Error:', error);
            try {
                const messages = conversationId ? await conversations.getRecentMessages(conversationId) : [];
                messages.unshift({
                    role: 'assistant',
                    content: `Welcome, adventurer ${state.gameState.charName}. I am Charma, your personal AI dungeon master. How would you like to begin your journey?`
                });
                res.render('index', await viewData.buildIndexData({
                    req,
                    response: `AI request failed: ${error.message}`,
                    prompt: userPrompt,
                    conversationId,
                    messages
                }));
            } catch (renderError) {
                next(renderError);
            }
        }
    });
    return router;
}

module.exports = { createAskRouter };
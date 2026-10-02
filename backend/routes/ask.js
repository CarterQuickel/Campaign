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
        const userPrompt = String(req.body.prompt || '').trim();
        let conversationId = Number(req.body.conversationId) || null;
        let userMessageSaved = false;
        if (!userPrompt) return res.status(400).json({ message: 'Enter a message first.' });
        try {
            if (!conversationId) {
                conversationId = await conversations.createConversation(userPrompt.slice(0, 80));
            }
            conversations.setResponsePending(conversationId, true, userPrompt);
            const history = await conversations.getRecentMessages(conversationId);
            await conversations.saveMessage(conversationId, 'user', userPrompt);
            userMessageSaved = true;
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
            conversations.setResponsePending(conversationId, false);
            return res.json({ conversationId, response: finalResponse });
        } catch (error) {
            console.error('Ollama Error:', error);
            try {
                const failureMessage = `AI request failed: ${error.message}`;
                if (conversationId && userMessageSaved) {
                    await conversations.saveMessage(conversationId, 'assistant', failureMessage);
                }
                return res.status(503).json({ conversationId, response: failureMessage });
            } catch (saveError) {
                return next(saveError);
            } finally {
                if (conversationId) conversations.setResponsePending(conversationId, false);
            }
        }
    });
    return router;
}

module.exports = { createAskRouter };
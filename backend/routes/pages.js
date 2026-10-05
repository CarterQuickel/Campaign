const express = require('express');

// Pages
function createPagesRouter({ state, viewData, conversations }) {
    const router = express.Router();
    router.post('/api/conversations', async (req, res, next) => {
        try {
            const title = String(req.body?.title || 'New conversation').trim().slice(0, 80) || 'New conversation';
            const conversationId = await conversations.createConversation(title);
            return res.status(201).json({ conversationId });
        } catch (error) {
            return next(error);
        }
    });
    router.get('/api/conversations/:id', async (req, res, next) => {
        try {
            const conversationId = Number(req.params.id);
            if (!Number.isInteger(conversationId) || conversationId < 1) {
                return res.status(400).json({ message: 'Invalid conversation ID.' });
            }
            const available = await conversations.getConversations();
            if (!available.some(conversation => conversation.id === conversationId)) {
                return res.status(404).json({ message: 'Conversation not found.' });
            }
            return res.json({
                conversationId,
                messages: await conversations.getMessages(conversationId),
                pending: conversations.isResponsePending(conversationId),
                pendingPrompt: conversations.getPendingPrompt(conversationId)
            });
        } catch (error) {
            return next(error);
        }
    });
    router.get('/', async (req, res, next) => {
        try {
            const allConversations = await conversations.getConversations();
            const requestedId = Number(req.query.conversationId) || null;
            const conversationId = requestedId && allConversations.some(item => item.id === requestedId)
                ? requestedId
                : allConversations[0]?.id || null;
            const messages = conversationId ? await conversations.getMessages(conversationId) : [];
            messages.unshift({
                role: 'assistant',
                content: `Welcome, adventurer ${state.gameState.charName}. I am Charma, your personal AI dungeon master. How would you like to begin your journey?`
            });
            res.render('index', await viewData.buildIndexData({
                req,
                messages,
                conversationId,
                responsePending: conversationId ? conversations.isResponsePending(conversationId) : false
            }));
        } catch (error) {
            next(error);
        }
    });
    router.post('/updateSheet', (req, res) => {
        const updated = state.updateCharacter({
            name: req.body.name,
            origin: req.body.origin,
            race: req.body.race,
            characterClass: req.body.class
        });
        if (!updated) return res.status(400).send('Unknown character class.');
        res.redirect('/');
    });
    router.get('/mastery', async (req, res, next) => {
        try {
            res.render('mastery', await viewData.buildMasteryData());
        } catch (error) {
            next(error);
        }
    });
    return router;
}

module.exports = { createPagesRouter };
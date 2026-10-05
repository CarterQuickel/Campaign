const express = require('express');

// Pages
function createPagesRouter({ state, viewData, conversations, combat }) {
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
            const snapshot = combat.getSnapshot();
            const activeCombat = snapshot.active && snapshot.conversationId === conversationId
                ? {
                    combatId: snapshot.combatId,
                    phase: snapshot.phase,
                    enemy: {
                        name: snapshot.enemy.name,
                        HP: snapshot.enemy.HP,
                        image: snapshot.enemy.image
                    },
                    enemyHP: snapshot.enemyHP,
                    playerHP: snapshot.playerHP,
                    question: snapshot.question
                }
                : null;
            return res.json({
                conversationId,
                messages: await conversations.getMessages(conversationId),
                pending: conversations.isResponsePending(conversationId),
                pendingPrompt: conversations.getPendingPrompt(conversationId),
                combat: activeCombat
            });
        } catch (error) {
            return next(error);
        }
    });
    router.get('/', async (req, res, next) => {
        try {
            const allConversations = await conversations.getConversations();
            const snapshot = combat.getSnapshot();
            const requestedId = Number(req.query.conversationId) || null;
            const requestedConversationId = requestedId && allConversations.some(item => item.id === requestedId)
                ? requestedId
                : allConversations[0]?.id || null;
            const conversationId = snapshot.active && snapshot.conversationId
                ? snapshot.conversationId
                : requestedConversationId;
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
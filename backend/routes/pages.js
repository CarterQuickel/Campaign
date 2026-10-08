const express = require('express');

// Pages
function createPagesRouter({ state, viewData, conversations, combat, isAuthenticated, getUserName }) {
    const router = express.Router();
    router.post('/api/conversations', async (req, res, next) => {
        if (!isAuthenticated(req)) return res.status(401).json({ message: 'Log in with Formbar to use Charma.' });
        try {
            const title = String(req.body?.title || 'New conversation').trim().slice(0, 80) || 'New conversation';
            const conversationId = await conversations.createConversation(req.accountId, title);
            return res.status(201).json({ conversationId });
        } catch (error) {
            return next(error);
        }
    });
    router.get('/api/conversations/:id', async (req, res, next) => {
        if (!isAuthenticated(req)) return res.status(401).json({ message: 'Log in with Formbar to use Charma.' });
        try {
            const conversationId = Number(req.params.id);
            if (!Number.isInteger(conversationId) || conversationId < 1) {
                return res.status(400).json({ message: 'Invalid conversation ID.' });
            }
            const available = await conversations.getConversations(req.accountId);
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
                messages: await conversations.getMessages(req.accountId, conversationId),
                pending: conversations.isResponsePending(conversationId),
                pendingPrompt: conversations.getPendingPrompt(conversationId),
                combat: activeCombat
            });
        } catch (error) {
            return next(error);
        }
    });
    router.get('/api/account-summary', async (req, res, next) => {
        if (!isAuthenticated(req)) return res.status(401).json({ message: 'Log in with Formbar to use Charma.' });
        try {
            return res.json({ formbarName: getUserName(req), accountSummary: await viewData.buildAccountSummary(req.accountId) });
        } catch (error) {
            return next(error);
        }
    });
    router.get('/', async (req, res, next) => {
        try {
            const snapshot = combat.getSnapshot();
            const allConversations = isAuthenticated(req) ? await conversations.getConversations(req.accountId) : [];
            const requestedId = Number(req.query.conversationId) || null;
            const requestedConversationId = requestedId && allConversations.some(item => item.id === requestedId)
                ? requestedId
                : allConversations[0]?.id || null;
            const conversationId = snapshot.active && snapshot.conversationId
                ? snapshot.conversationId
                : requestedConversationId;
            const messages = conversationId ? await conversations.getMessages(req.accountId, conversationId) : [];
            messages.unshift({
                role: 'assistant',
                content: `Welcome, adventurer ${state.gameState.charName}. I am Charma, your personal AI dungeon master. How would you like to begin your journey?`
            });
            res.render('index', await viewData.buildIndexData({
                req,
                isAuthenticated: isAuthenticated(req),
                formbarName: getUserName(req),
                messages,
                conversationId,
                responsePending: conversationId ? conversations.isResponsePending(conversationId) : false
            }));
        } catch (error) {
            next(error);
        }
    });
    router.post('/updateSheet', (req, res) => {
        if (!isAuthenticated(req)) return res.status(401).send('Log in with Formbar to update your character.');
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
        if (!isAuthenticated(req)) return res.redirect('/');
        try {
            res.render('mastery', await viewData.buildMasteryData());
        } catch (error) {
            next(error);
        }
    });
    return router;
}

module.exports = { createPagesRouter };
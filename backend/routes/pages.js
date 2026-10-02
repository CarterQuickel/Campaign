const express = require('express');

// Pages
function createPagesRouter({ state, viewData, conversations }) {
    const router = express.Router();
    router.get('/', async (req, res, next) => {
        try {
            const messages = [{
                role: 'assistant',
                content: `Welcome, adventurer ${state.gameState.charName}. I am Charma, your personal AI dungeon master. How would you like to begin your journey?`
            }];
            res.render('index', await viewData.buildIndexData({ req, messages }));
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
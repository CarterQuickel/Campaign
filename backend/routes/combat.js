const express = require('express');

// Combat
function createCombatRouter(combat) {
    const router = express.Router();
    router.post('/answer', (req, res) => {
        const result = combat.answer(String(req.body.answerId || ''));
        return res.status(result.status).json(result.body);
    });
    router.post('/attack', (req, res) => {
        const result = combat.attack(req.body.itemName);
        return res.status(result.status).json(result.body);
    });
    router.post('/continue', (req, res) => {
        const result = combat.continueCombat();
        return res.status(result.status).json(result.body);
    });
    return router;
}

module.exports = { createCombatRouter };
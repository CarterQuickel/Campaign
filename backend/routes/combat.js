const express = require('express');
const { system } = require('../../system');
const { stories } = require('../../StoryAPI/stories');
const { landmarks } = require('../../StoryAPI/landmarks');
const { storySpecRewards } = require('../../StoryAPI/storySpecRewards');
const { enemies } = require('../../enemies/enemyStats');

// Combat
function createCombatRouter({ combat, ai, conversations, actions }) {
    const router = express.Router();
    router.post('/answer', (req, res) => {
        const result = combat.answer(String(req.body.answerId || ''));
        return res.status(result.status).json(result.body);
    });
    router.post('/attack', (req, res) => {
        const result = combat.attack(req.body.itemName);
        return res.status(result.status).json(result.body);
    });
    router.post('/continue', async (req, res) => {
        const result = await combat.continueCombat();
        return res.status(result.status).json(result.body);
    });
    router.post('/resolve', async (req, res) => {
        const combatId = Number(req.body.combatId);
        const conversationId = Number(req.body.conversationId) || null;
        const cachedResponse = combat.getCompletedResolution(combatId, conversationId);
        if (cachedResponse !== null) {
            return res.json({ success: true, response: cachedResponse, alreadyResolved: true });
        }
        if (!conversationId) {
            return res.status(409).json({ success: false, message: 'This combat cannot be resolved.' });
        }
        const snapshot = combat.beginResolution(combatId, conversationId);
        if (!snapshot) {
            return res.status(409).json({ success: false, message: 'This combat cannot be resolved.' });
        }
        try {
            const history = await conversations.getRecentMessages(req.accountId, conversationId);
            const storyContext = {
                stories,
                landmarks,
                storySpecRewards,
                enemies: enemies.map(enemy => enemy.name),
                currentEncounter: {
                    enemy: snapshot.enemy.name,
                    outcome: snapshot.phase,
                    enemyDetails: Object.values(snapshot.enemy.attacks || {}).map(attack => ({
                        name: attack.header,
                        description: attack.desc
                    }))
                }
            };
            const outcomePrompt = snapshot.phase === 'won'
                ? `Continue the existing scene in 2-4 vivid, concise paragraphs. The player was VICTORIOUS and defeated ${snapshot.enemy.name} (remaining combat HP: ${snapshot.playerHP}). Clearly acknowledge this victory and describe what happens to this specific enemy and the immediate aftermath, drawing on its listed traits or attacks where relevant. Then advance the same adventure with a concrete development or decision for the player. Do not use generic transition phrases such as "the story continues," do not invent a reward, and do not start another combat.`
                : `Continue the existing scene in 2-4 vivid, concise paragraphs. The player was DEFEATED by ${snapshot.enemy.name} (remaining combat HP: ${snapshot.playerHP}). Clearly acknowledge this defeat and describe a non-graphic, enemy-specific aftermath, drawing on its listed traits or attacks where relevant. Do not assume the player is dead; establish a plausible immediate consequence and give them a clear next step or decision. Do not use generic transition phrases such as "the story continues," and do not start another combat.`;
            const responseText = await ai.generateReply({
                userPrompt: outcomePrompt,
                history,
                system,
                storyContext
            });
            const finalResponse = (actions.apply(responseText, {
                conversationId,
                allowCombatStart: false
            }) || responseText).trim();
            await conversations.saveMessage(req.accountId, conversationId, 'assistant', finalResponse);
            if (!combat.close(combatId, finalResponse)) {
                return res.status(409).json({ success: false, message: 'Combat has already changed.' });
            }
            return res.json({ success: true, response: finalResponse, outcome: snapshot.phase });
        } catch (error) {
            combat.cancelResolution(combatId);
            console.error('Unable to generate combat continuation:', error);
            return res.status(503).json({ success: false, message: 'Unable to continue the story right now. Please try again.' });
        }
    });
    return router;
}

module.exports = { createCombatRouter };
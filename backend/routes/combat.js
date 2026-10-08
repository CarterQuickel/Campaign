const express = require('express');
const { system } = require('../../system');
const { stories } = require('../../StoryAPI/stories');
const { landmarks } = require('../../StoryAPI/landmarks');
const { storySpecRewards } = require('../../StoryAPI/storySpecRewards');
const { enemies } = require('../../enemies/enemyStats');

// Combat
function createCombatRouter({ combat, ai, conversations, actions }) {
    const router = express.Router();
    const pendingResolutions = new Map();
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
        const key = `${combatId}:${conversationId || ''}`;
        let resolution = pendingResolutions.get(key);
        if (!resolution) {
            resolution = resolveCombat({ combatId, conversationId })
                .finally(() => pendingResolutions.delete(key));
            pendingResolutions.set(key, resolution);
        }
        const result = await resolution;
        return res.status(result.status).json(result.body);
    });

    async function resolveCombat({ combatId, conversationId }) {
        const cachedResponse = combat.getCompletedResolution(combatId, conversationId);
        if (cachedResponse !== null) {
            return {
                status: 200,
                body: {
                    success: true,
                    response: cachedResponse,
                    alreadyResolved: true,
                    playerHP: combat.getSnapshot().playerHP
                }
            };
        }
        if (!conversationId) {
            return { status: 409, body: { success: false, message: 'This combat cannot be resolved.' } };
        }
        const snapshot = combat.beginResolution(combatId, conversationId);
        if (!snapshot) {
            return { status: 409, body: { success: false, message: 'This combat cannot be resolved.' } };
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
                ? `In no more than 3 short sentences (about 50 words), acknowledge that ${snapshot.enemy.name} was defeated, give one concise detail about the immediate aftermath, and end with a clear next choice. Do not add a reward or start another combat.`
                : `In no more than 3 short sentences (about 50 words), acknowledge the defeat by ${snapshot.enemy.name}, describe a non-graphic immediate consequence without assuming the player is dead, and end with a clear next choice. Do not start another combat.`;
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
                return { status: 409, body: { success: false, message: 'Combat has already changed.' } };
            }
            return {
                status: 200,
                body: {
                    success: true,
                    response: finalResponse,
                    outcome: snapshot.phase,
                    playerHP: combat.getSnapshot().playerHP
                }
            };
        } catch (error) {
            combat.cancelResolution(combatId);
            console.error('Unable to generate combat continuation:', error);
            return {
                status: 503,
                body: { success: false, message: 'Unable to continue the story right now. Please try again.' }
            };
        }
    }
    return router;
}

module.exports = { createCombatRouter };
const express = require('express');
const { system } = require('../../system');
const { stories } = require('../../StoryAPI/stories');
const { landmarks } = require('../../StoryAPI/landmarks');
const { storySpecRewards } = require('../../StoryAPI/storySpecRewards');
const { Tools } = require('../../StoryAPI/tools');
const { enemies } = require('../../enemies/enemyStats');

// Combat
function createCombatRouter({ combat, ai, conversations, actions, storyDocument, onBossRushLoss = async () => {} }) {
    const router = express.Router();
    const pendingResolutions = new Map();
    router.post('/answer', (req, res) => {
        const result = combat.answer(String(req.body.answerId || ''), req.body.combatId);
        return res.status(result.status).json(result.body);
    });
    router.post('/attack', (req, res) => {
        const result = combat.attack(req.body.itemName, req.body.combatId);
        return res.status(result.status).json(result.body);
    });
    router.post('/advance-boss-rush', async (req, res) => {
        const result = combat.advanceBossRush(req.body.combatId);
        if (!result.success) return res.status(409).json(result);
        if (result.combat.active) {
            try {
                await combat.prepareQuestion();
            } catch (error) {
                console.error('Unable to prepare the next boss-rush encounter:', error);
                return res.status(503).json({ success: false, message: 'The next boss could not be prepared. Please retry.' });
            }
        }
        return res.json({ ...result, combat: combat.getSnapshot() });
    });
    router.post('/continue', async (req, res) => {
        const result = await combat.continueCombat(req.body.combatId);
        return res.status(result.status).json(result.body);
    });
    router.post('/resolve', async (req, res) => {
        const combatId = Number(req.body.combatId);
        const conversationId = Number(req.body.conversationId) || null;
        const key = `${combatId}:${conversationId || ''}`;
        let resolution = pendingResolutions.get(key);
        if (!resolution) {
            resolution = resolveCombat({ combatId, conversationId, accountId: req.accountId })
                .finally(() => pendingResolutions.delete(key));
            pendingResolutions.set(key, resolution);
        }
        const result = await resolution;
        return res.status(result.status).json(result.body);
    });

    async function resolveCombat({ combatId, conversationId, accountId }) {
        const cachedResponse = combat.getCompletedResolution(combatId, conversationId);
        if (cachedResponse !== null) {
            return {
                status: 200,
                body: {
                    success: true,
                    response: cachedResponse.responseText,
                    alreadyResolved: true,
                    playerHP: combat.getSnapshot().playerHP,
                    combat: combat.getSnapshot(),
                    bossRush: cachedResponse.bossRush,
                    bossRushComplete: cachedResponse.bossRushComplete,
                    bossRushLost: cachedResponse.bossRushLost
                },
                storyDocument
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
            if (snapshot.phase === 'lost' && snapshot.bossRush.active) {
                const responseText = `Defeated by ${snapshot.enemy.name}. Your boss rush is over; your campaign progress has been reset.`;
                const closed = combat.close(combatId, responseText);
                if (!closed) return { status: 409, body: { success: false, message: 'Combat has already changed.' } };
                await onBossRushLoss(accountId);
                return {
                    status: 200,
                    body: {
                        success: true,
                        response: responseText,
                        outcome: 'lost',
                        bossRush: true,
                        bossRushLost: true,
                        combat: combat.getSnapshot()
                    }
                };
            }
            const history = await conversations.getRecentMessages(accountId, conversationId);
            const storyPart = await conversations.getStoryPart(accountId, conversationId);
            const currentStoryPart = storyDocument.find(part => part.number === storyPart);
            const storyRewardItems = storySpecRewards.flatMap(story => story.rewards || []);
            const itemCatalog = [...Tools, ...storyRewardItems]
                .filter((item, index, items) => items.findIndex(candidate => candidate.name === item.name) === index)
                .map(({ name, CharacterClass, class: itemClass, damage, AC, desc, weight }) => ({
                    name,
                    CharacterClass: CharacterClass || 'Any',
                    class: itemClass,
                    damage,
                    AC,
                    desc,
                    weight
                }));
            const storyContext = {
                stories,
                landmarks,
                storySpecRewards,
                availableItems: itemCatalog.map(item => item.name),
                itemCatalog,
                enemyCatalog: enemies.map(({ name, HP, AC, attacks }) => ({ name, HP, AC, attacks })),
                enemies: enemies.map(enemy => enemy.name),
                storyDocument: currentStoryPart?.text || '',
                storyPart,
                totalStoryParts: storyDocument.length,
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
            await conversations.saveMessage(accountId, conversationId, 'assistant', finalResponse);
            const closed = combat.close(combatId, finalResponse);
            if (!closed) {
                return { status: 409, body: { success: false, message: 'Combat has already changed.' } };
            }
            let nextCombat = combat.getSnapshot();
            if (nextCombat.active && nextCombat.bossRush.active) {
                try {
                    await combat.prepareQuestion();
                    nextCombat = combat.getSnapshot();
                } catch (error) {
                    console.error('Unable to load the next boss-rush question:', error);
                }
            }
            if (closed.bossRushLost) {
                await onBossRushLoss(accountId);
                nextCombat = combat.getSnapshot();
            }
            return {
                status: 200,
                body: {
                    success: true,
                    response: finalResponse,
                    outcome: snapshot.phase,
                    playerHP: combat.getSnapshot().playerHP,
                    combat: nextCombat,
                    bossRush: closed.bossRush,
                    bossRushComplete: closed.bossRushComplete,
                    bossRushLost: closed.bossRushLost
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
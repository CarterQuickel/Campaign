const express = require('express');
const { system } = require('../../system');
const { stories } = require('../../StoryAPI/stories');
const { landmarks } = require('../../StoryAPI/landmarks');
const { storySpecRewards } = require('../../StoryAPI/storySpecRewards');
const { enemies } = require('../../enemies/enemyStats');

// Initial root directory
function createAskRouter({ state, conversations, ai, actions, viewData, combat, storyDocument }) {
    const router = express.Router();
    router.post('/', async (req, res, next) => {
        if (!state.gameState.characterSetupComplete) {
            return res.status(409).json({ message: 'Create your character before starting a conversation.' });
        }
        const userPrompt = String(req.body.prompt || '').trim();
        let conversationId = Number(req.body.conversationId) || null;
        let userMessageSaved = false;
        if (!userPrompt) return res.status(400).json({ message: 'Enter a message first.' });
        try {
            if (!conversationId) {
                conversationId = await conversations.createConversation(req.accountId, userPrompt.slice(0, 80));
            }
            conversations.setResponsePending(conversationId, true, userPrompt);
            const history = await conversations.getRecentMessages(req.accountId, conversationId);
            await conversations.saveMessage(req.accountId, conversationId, 'user', userPrompt);
            const totalStoryParts = storyDocument.length;
            const shouldAdvanceStory = /^(?:continue|continue story|next part|continue to the next part|next chapter)$/i.test(userPrompt);
            const storyPart = shouldAdvanceStory
                ? await conversations.advanceStoryPart(req.accountId, conversationId, totalStoryParts)
                : await conversations.getStoryPart(req.accountId, conversationId);
            const currentStoryPart = storyDocument.find(part => part.number === storyPart);
            userMessageSaved = true;
            const storyRewardItems = storySpecRewards.flatMap(story => story.rewards || []);
            const itemCatalog = [...state.gameState.tools, ...storyRewardItems]
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
            const unlockedItemNames = new Set(state.gameState.tools
                .filter(item => item.unlocked)
                .map(item => item.name?.trim().toLowerCase()));
            const testRewardCandidates = itemCatalog
                .filter(item => (item.CharacterClass === 'Any' || item.CharacterClass === state.gameState.charClass)
                    && !unlockedItemNames.has(item.name.trim().toLowerCase()))
                .map(item => item.name);
            const storyContext = {
                stories,
                landmarks,
                storySpecRewards,
                characterClass: state.gameState.charClass,
                availableItems: [...new Set([
                    ...state.gameState.tools.map(item => item.name),
                    ...storyRewardItems.map(item => item.name)
                ])],
                itemCatalog,
                testRewardCandidates,
                isOpeningScene: !history.some(message => message.role === 'user'),
                enemyCatalog: enemies.map(({ name, HP, AC, attacks }) => ({ name, HP, AC, attacks })),
                enemies: enemies.map(enemy => enemy.name),
                storyDocument: currentStoryPart?.text || '',
                storyPart,
                totalStoryParts,
                storyPartAdvanced: shouldAdvanceStory
            };
            const responseText = await ai.generateReply({ userPrompt, history, system, storyContext });
            let startedCombat = null;
            let finalResponse = actions.apply(responseText, {
                conversationId,
                onCombatStarted: result => { startedCombat = result; }
            }) || responseText;
            finalResponse = finalResponse.trim();
            await conversations.saveMessage(req.accountId, conversationId, 'assistant', finalResponse);
            let combatPrompt = null;
            if (startedCombat) {
                await combat.prepareQuestion();
                const snapshot = combat.getSnapshot();
                combatPrompt = {
                    combatId: snapshot.combatId,
                    phase: snapshot.phase,
                    enemy: {
                        name: snapshot.enemy.name,
                        HP: snapshot.enemy.HP,
                        image: snapshot.enemy.image
                    },
                    enemyHP: snapshot.enemyHP,
                    playerHP: snapshot.playerHP,
                    playerMaxHP: snapshot.playerMaxHP,
                    question: snapshot.question
                };
            }
            conversations.setResponsePending(conversationId, false);
            return res.json({ conversationId, response: finalResponse, combat: combatPrompt });
        } catch (error) {
            console.error('Ollama Error:', error);
            try {
                const failureMessage = `AI request failed: ${error.message}`;
                if (conversationId && userMessageSaved) {
                    await conversations.saveMessage(req.accountId, conversationId, 'assistant', failureMessage);
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
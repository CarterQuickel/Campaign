// This is used for site pages so when they render these are initiated
function createViewData({ state, combat, conversations, ai }) {
    async function buildAccountSummary(accountId) {
        const accountConversations = await conversations.getConversations(accountId);
        const unlockedTools = state.gameState.tools.filter(tool => tool.unlocked);
        const equippedTools = state.gameState.tools.filter(tool => tool.equipped);
        const savedChats = await Promise.all(accountConversations.map(async conversation => ({
            ...conversation,
            messages: await conversations.getMessages(accountId, conversation.id)
        })));
        const progression = state.getProgression();
        return {
            characterName: state.gameState.charName,
            characterClass: state.gameState.charClass,
            characterRace: state.gameState.charRace,
            level: progression.level,
            xp: progression.XP,
            maxXp: progression.MAXXP,
            hp: state.gameState.HP,
            inventoryItems: unlockedTools.map(tool => tool.name),
            equippedItems: equippedTools.map(tool => tool.name),
            savedChats
        };
    }

    async function buildIndexData({ req, isAuthenticated = false, username = null, response = null, prompt = null, conversationId = null, messages = [], responsePending = false }) {
        await combat.prepareQuestion();
        const snapshot = combat.getSnapshot();
        const progression = state.getProgression();
        const accountConversations = await conversations.getConversations(req?.accountId);
        const accountSummary = await buildAccountSummary(req?.accountId);
        return {
            response,
            prompt,
            conversations: accountConversations,
            conversationId: snapshot.active && snapshot.conversationId
                ? snapshot.conversationId
                : conversationId || snapshot.conversationId,
            accountSummary,
            messages,
            responsePending,
            isAuthenticated,
            username,
            online: await ai.checkStatus(),
            stats: state.stats,
            appearance: state.appearance,
            characterClasses: state.characterClasses,
            tools: state.gameState.tools,
            mastery: state.masteryCourseSets,
            ...progression,
            claimedMilestones: [...state.claimedMilestones],
            req: req?.session?.user || null,
            charData: {
                name: state.gameState.charName,
                class: state.gameState.charClass,
                race: state.gameState.charRace,
                origin: state.gameState.charOrigin,
                HP: state.gameState.HP
            },
            characterSetupComplete: state.gameState.characterSetupComplete,
            enemies: snapshot.enemy,
            enemyHP: snapshot.enemyHP,
            playerHP: snapshot.playerHP,
            combatActive: snapshot.active,
            combatBossRushActive: snapshot.bossRush?.active || false,
            combatId: snapshot.combatId,
            combatPhase: snapshot.phase,
            combatQuestion: snapshot.question
        };
    }

    async function buildMasteryData() {
        const progression = state.getProgression();
        const snapshot = combat.getSnapshot();
        return {
            stats: state.stats,
            appearance: state.appearance,
            online: await ai.checkStatus(),
            tools: state.gameState.tools,
            mastery: state.masteryCourseSets,
            ...progression,
            claimedMilestones: [...state.claimedMilestones],
            charData: {
                name: state.gameState.charName,
                class: state.gameState.charClass,
                race: state.gameState.charRace,
                origin: state.gameState.charOrigin,
                HP: state.gameState.HP
            },
            enemies: snapshot.enemy,
            enemyHP: snapshot.enemyHP,
            playerHP: snapshot.playerHP,
            combatActive: snapshot.active,
            combatId: snapshot.combatId,
            combatPhase: snapshot.phase,
            combatQuestion: snapshot.question
        };
    }

    return { buildAccountSummary, buildIndexData, buildMasteryData };
}

module.exports = { createViewData };
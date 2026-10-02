// This is used for site pages so when they render these are initiated
function createViewData({ state, combat, conversations, ai }) {
    async function buildIndexData({ req, response = null, prompt = null, conversationId = null, messages = [] }) {
        await combat.prepareQuestion();
        const snapshot = combat.getSnapshot();
        const progression = state.getProgression();
        return {
            response,
            prompt,
            conversations: await conversations.getConversations(),
            conversationId: conversationId || snapshot.conversationId,
            messages,
            online: await ai.checkStatus(),
            stats: state.stats,
            tools: state.gameState.tools,
            mastery: state.masteryCourseSets,
            ...progression,
            claimedMilestones: [...state.claimedMilestones],
            gold: state.gameState.gold,
            req: req?.session?.user || null,
            charData: {
                name: state.gameState.charName,
                class: state.gameState.charClass,
                race: state.gameState.charRace,
                origin: state.gameState.charOrigin,
                HP: state.gameState.HP,
                weight: state.gameState.weight,
                Mweight: state.gameState.maxWeight
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

    async function buildMasteryData() {
        const progression = state.getProgression();
        const snapshot = combat.getSnapshot();
        return {
            stats: state.stats,
            online: await ai.checkStatus(),
            tools: state.gameState.tools,
            mastery: state.masteryCourseSets,
            gold: state.gameState.gold,
            ...progression,
            claimedMilestones: [...state.claimedMilestones],
            charData: {
                name: state.gameState.charName,
                class: state.gameState.charClass,
                race: state.gameState.charRace,
                origin: state.gameState.charOrigin,
                HP: state.gameState.HP,
                weight: state.gameState.weight,
                Mweight: state.gameState.maxWeight
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

    return { buildIndexData, buildMasteryData };
}

module.exports = { createViewData };
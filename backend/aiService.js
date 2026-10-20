const { convoNamer } = require('../convoNamer');

const DEFAULT_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || process.env.AI_MODEL || 'llama3.2:latest';

// AI Responses
function createAiService({
    fetchImpl = fetch,
    baseUrl = DEFAULT_BASE_URL,
    model = DEFAULT_MODEL
} = {}) {
    async function checkStatus() {
        try {
            const response = await fetchImpl(`${baseUrl}/api/tags`);
            if (!response.ok) return false;
            const data = await response.json();
            return Array.isArray(data.models) && data.models.length > 0;
        } catch {
            return false;
        }
    }
    async function createTitle(prompt) {
        const response = await fetchImpl(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt: `Create a title for this quest or conversation:\n${prompt}`,
                system: convoNamer,
                options: { temperature: 0.2, num_predict: 12 },
                stream: false
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `AI server returned HTTP ${response.status}`);
        return data.response.trim().split(/\r?\n/)[0].replace(/^[*#"']+|[*#"']+$/g, '').trim().split(/\s+/).slice(0, 5).join(' ');
    }
    async function generateReply({ userPrompt, history, system, storyContext }) {
        const storyDocument = storyContext.storyDocument || '(No story document was provided.)';
        const { storyDocument: ignoredStoryDocument, ...storyApiContext } = storyContext;
        const availableItems = Array.isArray(storyContext.availableItems)
            ? storyContext.availableItems
            : [];
        const itemCatalog = Array.isArray(storyContext.itemCatalog) ? storyContext.itemCatalog : [];
        const enemyCatalog = Array.isArray(storyContext.enemyCatalog) ? storyContext.enemyCatalog : [];
        const storyRewardLore = Array.isArray(storyContext.storySpecRewards)
            ? storyContext.storySpecRewards.flatMap(story => (Array.isArray(story.rewards) ? story.rewards : [])).map(({ name, CharacterClass, desc }) => ({
                name,
                CharacterClass: CharacterClass || 'Any',
                description: desc || 'No description provided.'
            }))
            : [];
        const isRandomToolTest = /^TEST:\s*Give me a random tool$/i.test(userPrompt);
        const testRewardInstruction = isRandomToolTest
            ? `TEST COMMAND OVERRIDE: You must choose exactly one item from this fresh eligible candidate list: ${JSON.stringify(storyContext.testRewardCandidates || [])}. Choose one candidate, describe it briefly, and include exactly one action in this format: <ACTION>{"name":"unlock_item","item":"Exact Candidate Name"}</ACTION>. The action is the authority that grants the item. Do not choose an item outside the list, do not choose an already unlocked item, and do not say an item was granted without the action.`
            : '';
        const openingInstruction = storyContext.isOpeningScene
            ? 'OPENING SCENE RULE: This is the first turn. Start at the entrance to the ruined kingdom of Haldritch. Establish the ruined palace in the distance and the nearby Scouts\' Camp, then direct the hero toward the Fallen Palace. Do not begin in a later location, skip ahead, or assume the hero has already met the Oracle or entered another landmark.'
            : '';
        const storyProgressInstruction = storyContext.totalStoryParts
            ? `STORY PROGRESS: You are in story part ${storyContext.storyPart} of ${storyContext.totalStoryParts}. Use only the current part below. Do not reveal events from later parts. ${storyContext.storyPartAdvanced ? 'The player has just continued to this part, so begin its opening scene.' : 'When the current part reaches a natural ending, tell the player to say "Continue Story".'}`
            : '';
        const response = await fetchImpl(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt: [
                    `You are a helpful assistant. Use the conversation history when it is relevant. Be concise: normal gameplay replies should always be 2-4 short sentences. Finish every response cleanly; do not stop mid-sentence or leave a thought unfinished.\nENEMY LIST RULE: You may only introduce, describe as present, or initiate combat with enemies whose exact names appear in the enemies list in the provided StoryAPI data. Never invent, rename, substitute, or imply any other enemy. If the story suggests an enemy not on that list, use an allowed listed enemy only when it fits naturally; otherwise describe the threat without introducing an enemy or starting combat.\nCRITICAL COMBAT ACTION RULE: When an encounter with a listed enemy actually becomes combat, include this exact machine-readable action with the enemy field exactly matching one name from the enemies list: <ACTION>{"name":"start_combat","enemy":"Exact Enemy Name"}</ACTION>. Include at most one brief setup sentence with the action, or just the action. Do not narrate any combat turn, attack, injury, damage, hit, miss, victory, or defeat; do not say the player takes damage or describe the player's actions. The combat interface handles combat. Never start combat merely because an enemy is mentioned.\nITEM CLASS RULE: The player's class is provided in StoryAPI data. An item may only be unlocked when its CharacterClass is Any or exactly matches the player's class. Never claim that a class-restricted item was obtained by a different class, and do not output an unlock_item action for a restricted item.\nUse the following StoryAPI data as the source of truth for the adventure:\n${JSON.stringify(storyApiContext, null, 2)}\n\nIf a story, landmark, reward, or story hook matches the current scene, incorporate it naturally and keep the world consistent with the provided data.`,
                    openingInstruction,
                    testRewardInstruction,
                    `STORY-SPECIFIC REWARD LORE (authoritative; these named rewards are part of the world even when the player cannot currently unlock them):\n${JSON.stringify(storyRewardLore, null, 2)}`,
                    storyProgressInstruction,
                    `STORY DOCUMENT CONTEXT (use this for the world's narrative, lore, and plot details; do not contradict it):\n${storyDocument}`,
                    `FINAL ITEM RULE: Inventory item names come ONLY from the canonical item list below, which is built from StoryAPI/storySpecRewards.js and StoryAPI/tools.js. The story document is lore only and MUST NOT introduce, award, or rename an item. Never say the player received, picked up, was given, or now has an item unless its exact name appears in this list and you output the unlock_item action with that exact name. The item named flashlight is not valid unless it appears in this list. Canonical item list: ${JSON.stringify(availableItems)}`,
                    `AUTHORITATIVE ITEM DATA: Use only the exact fields in this catalog for item names, classes, damage, AC, weight, and descriptions. Do not invent abilities, passive effects, active effects, damage, or other statistics. If a field is absent or does not support a claim, say that no such detail is defined.\n${JSON.stringify(itemCatalog, null, 2)}`,
                    `AUTHORITATIVE ENEMY DATA: You may only describe enemy HP, AC, attacks, attack names, and damage using this catalog. Do not invent enemy statistics, attacks, abilities, or combat outcomes. If an enemy is not in this catalog, do not introduce it.\n${JSON.stringify(enemyCatalog, null, 2)}`,
                    ...history.map(message => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`),
                    openingInstruction,
                    `User: ${userPrompt}`,
                    'Assistant:'
                ].join(`\n\n`),
                system,
                options: { num_predict: 512 },
                stream: false
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `AI server returned HTTP ${response.status}`);
        return typeof data.response === 'string' ? data.response.replace(/^[ \t]+/gm, '').trim() : '';
    }
    return { checkStatus, createTitle, generateReply };
}

module.exports = { createAiService };
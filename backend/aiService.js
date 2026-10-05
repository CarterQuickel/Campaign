const { convoNamer } = require('../convoNamer');

// AI Responses
function createAiService({ fetchImpl = fetch, baseUrl = 'http://localhost:11434', model = 'llama3.2' } = {}) {
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
        const response = await fetchImpl(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt: [
                    `You are a helpful assistant. Use the conversation history when it is relevant.\nENEMY LIST RULE: You may only introduce, describe as present, or initiate combat with enemies whose exact names appear in the enemies list in the provided StoryAPI data. Never invent, rename, substitute, or imply any other enemy. If the story suggests an enemy not on that list, use an allowed listed enemy only when it fits naturally; otherwise describe the threat without introducing an enemy or starting combat.\nCRITICAL COMBAT ACTION RULE: When an encounter with a listed enemy actually becomes combat, you MUST include this exact machine-readable action in your reply, with the enemy field exactly matching one name from the enemies list: <ACTION>{"name":"start_combat","enemy":"Exact Enemy Name"}</ACTION>. Do not only narrate the start of combat; the action is required to open the combat question panel.\nUse the following StoryAPI data as the source of truth for the adventure:\n${JSON.stringify(storyContext, null, 2)}\n\nIf a story, landmark, reward, or story hook matches the current scene, incorporate it naturally and keep the world consistent with the provided data.`,
                    ...history.map(message => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`),
                    `User: ${userPrompt}`,
                    'Assistant:'
                ].join('\n\n'),
                system,
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
const { convoNamer } = require('../convoNamer.js');

function addDefaultAiMessage(state, messages = []) {
    const defaultAiMessage = {
        role: 'assistant',
        content: `Welcome, adventurer ${state.charName}. I am Charma, your personal AI dungeon master. How would you like to begin your journey?`
    };
    return [defaultAiMessage, ...messages];
}

async function getConversationTitle(prompt) {
    const ollamaTitle = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'llama3.2',
            prompt: `Create a title for this quest or conversation:\n${prompt}`,
            system: convoNamer,
            options: { temperature: 0.2, num_predict: 12 },
            stream: false
        })
    });

    const titleData = await ollamaTitle.json();
    if (!ollamaTitle.ok) {
        throw new Error(titleData.error || `AI server returned HTTP ${ollamaTitle.status}`);
    }

    return titleData.response
        .trim()
        .split(/\r?\n/)[0]
        .replace(/^[*#"']+|[*#"']+$/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .join(' ');
}

let online = false;

async function checkAiStatus() {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) {
            online = false;
            return false;
        }
        const data = await response.json();
        online = Array.isArray(data.models) && data.models.length > 0;
        return online;
    } catch (error) {
        online = false;
        return false;
    }
}

function parseGameActionFromText(responseText) {
    if (typeof responseText !== 'string') {
        return null;
    }
    const text = responseText.trim();
    const tagMatch = text.match(/<ACTION>\s*([\s\S]*?)\s*<\/ACTION>/i);
    if (tagMatch) {
        try {
            const parsed = JSON.parse(tagMatch[1]);
            if (parsed && parsed.name === 'give_gold') {
                return { name: 'give_gold', amount: Number(parsed.amount ?? parsed.gold_amount ?? 0) };
            }
        } catch (error) {
            console.error('Could not parse game action tag:', error.message);
        }
    }
    const directJsonMatch = text.match(/\{\s*"name"\s*:\s*"give_gold"\s*,\s*"amount"\s*:\s*(\d+)\s*\}/i);
    if (directJsonMatch) {
        return { name: 'give_gold', amount: Number(directJsonMatch[1]) };
    }
    const giveGoldFnMatch = text.match(/give_gold\s*\(\s*(\d+)\s*\)/i);
    if (giveGoldFnMatch) {
        return { name: 'give_gold', amount: Number(giveGoldFnMatch[1]) };
    }
    const inlineAmountMatch = text.match(/(?:reward|gave|grant|awarded?)\s+(\d+)\s*(?:gp|gold)/i);
    if (inlineAmountMatch) {
        return { name: 'give_gold', amount: Number(inlineAmountMatch[1]) };
    }
    return null;
}

function applyActionFromText(responseText, state) {
    if (typeof responseText !== 'string') {
        return responseText;
    }
    const action = parseGameActionFromText(responseText);
    if (!action) {
        return responseText;
    }
    if (action.name === 'give_gold') {
        const amount = Number(action.amount ?? 0);
        if (Number.isFinite(amount) && amount !== 0) {
            state.gold = (Number(state.gold) || 0) + amount;
        }
    }
    const cleanedText = responseText
        .replace(/<ACTION>[\s\S]*?<\/ACTION>/gi, '')
        .replace(/\{\s*"name"\s*:\s*"give_gold"\s*,\s*"amount"\s*:\s*\d+\s*\}/gi, '')
        .replace(/give_gold\s*\(\s*\d+\s*\)/gi, '')
        .replace(/(?:reward|gave|grant|awarded?)\s+\d+\s*(?:gp|gold)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleanedText) {
        return cleanedText;
    }
    if (action.name === 'give_gold') {
        return `You receive ${action.amount} gold.`;
    }
    return responseText.trim();
}

module.exports = {
    addDefaultAiMessage,
    getConversationTitle,
    checkAiStatus,
    parseGameActionFromText,
    applyActionFromText
};

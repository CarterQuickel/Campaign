function parseGameActionFromText(responseText) {
    if (typeof responseText !== 'string') return null;
    const text = responseText.trim();
    const tagMatch = text.match(/<ACTION>\s*([\s\S]*?)\s*<\/ACTION>/i);
    if (tagMatch) {
        try {
            const parsed = JSON.parse(tagMatch[1]);
            if (parsed?.name === 'give_gold') {
                return { name: 'give_gold', amount: Number(parsed.amount ?? parsed.gold_amount ?? 0) };
            }
            if (parsed?.name === 'unlock_item') {
                return { name: 'unlock_item', item: String(parsed.item || '').trim(), storyReward: parsed.storyReward === true };
            }
        } catch (error) {
            console.error('Could not parse game action tag:', error.message);
        }
    }
    const directJsonMatch = text.match(/\{\s*"name"\s*:\s*"give_gold"\s*,\s*"amount"\s*:\s*(\d+)\s*\}/i);
    if (directJsonMatch) return { name: 'give_gold', amount: Number(directJsonMatch[1]) };
    const giveGoldFnMatch = text.match(/give_gold\s*\(\s*(\d+)\s*\)/i);
    if (giveGoldFnMatch) return { name: 'give_gold', amount: Number(giveGoldFnMatch[1]) };
    const inlineAmountMatch = text.match(/(?:reward|gave|grant|awarded?)\s+(\d+)\s*(?:gp|gold)/i);
    return inlineAmountMatch ? { name: 'give_gold', amount: Number(inlineAmountMatch[1]) } : null;
}

// Game Actions Execuatble by the AI
function createGameActionService({ gameState, rewards, emitInventoryUpdate = () => {} }) {
    function apply(responseText) {
        if (typeof responseText !== 'string') return responseText;
        const action = parseGameActionFromText(responseText);
        if (!action) return responseText;
        console.log('GAME ACTION:', action);

        if (action.name === 'give_gold') {
            const amount = Number(action.amount ?? 0);
            if (Number.isFinite(amount) && amount !== 0) gameState.gold = (Number(gameState.gold) || 0) + amount;
        }
        if (action.name === 'unlock_item') {
            const reward = (Array.isArray(rewards) ? rewards : [])
                .flatMap(story => story.rewards || [])
                .find(item => item.name?.trim().toLowerCase() === action.item?.trim().toLowerCase());
            if (!reward) {
                console.log('ITEM NOT FOUND:', action.item);
            } else {
                let item = gameState.tools.find(tool => tool.name?.trim().toLowerCase() === reward.name.trim().toLowerCase());
                if (!item) {
                    item = { ...reward };
                    gameState.tools.push(item);
                }
                item.unlocked = true;
                console.log('UNLOCKED ITEM:', item.name);
                emitInventoryUpdate(gameState.tools);
            }
        }
        // Cleanup how the AI types out the given reward
        const cleanedText = responseText
            .replace(/<ACTION>[\s\S]*?<\/ACTION>/gi, '')
            .replace(/\{\s*"name"\s*:\s*"give_gold"\s*,\s*"amount"\s*:\s*\d+\s*\}/gi, '')
            .replace(/give_gold\s*\(\s*\d+\s*\)/gi, '')
            .replace(/(?:reward|gave|grant|awarded?)\s+\d+\s*(?:gp|gold)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (cleanedText) return cleanedText;
        if (action.name === 'give_gold') return `You receive ${action.amount} gold.`;
        if (action.name === 'unlock_item') return `You have unlocked the ${action.item}.`;
        return responseText.trim();
    }
    return { apply };
}

module.exports = { createGameActionService, parseGameActionFromText };
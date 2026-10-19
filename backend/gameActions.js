function parseGameActionFromText(responseText) {
    if (typeof responseText !== 'string') return null;
    const text = responseText.trim();
    const tagMatch = text.match(/<ACTION>\s*([\s\S]*?)\s*<\/ACTION>/i);
    if (tagMatch) {
        try {
            const parsed = JSON.parse(tagMatch[1]);
            if (parsed?.name === 'unlock_item') {
                return { name: 'unlock_item', item: String(parsed.item || '').trim(), storyReward: parsed.storyReward === true };
            }
            if (parsed?.name === 'start_combat') {
                return { name: 'start_combat', enemy: String(parsed.enemy || parsed.enemies || '').trim() };
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

function inferCombatActionFromText(responseText, enemies) {
    const text = String(responseText || '');
    const activeCombatLanguage = /\b(?:attacks?|strikes?|lunges(?: at)?|charges(?: at)?|rushes(?: at)?|ambushes?|pounces(?: on)?|fires at|swings at|leaps at|turns on)\b|\b(?:combat|battle|fight) (?:begins|starts)\b/i;
    if (!activeCombatLanguage.test(text)) return null;

    return (Array.isArray(enemies) ? enemies : []).find(enemy => {
        const name = typeof enemy === 'string' ? enemy : enemy?.name;
        if (!name) return false;
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escapedName}\\b`, 'i').test(text);
    }) || null;
}

// Game Actions Execuatble by the AI
function createGameActionService({ gameState, rewards, enemies = [], emitInventoryUpdate = () => {}, startCombat = () => ({ success: false }) }) {
    function getItemCandidates() {
        return [
            ...(Array.isArray(gameState.tools) ? gameState.tools : []),
            ...(Array.isArray(rewards) ? rewards.flatMap(story => story.rewards || []) : [])
        ];
    }

    function unlockItem(itemName) {
        const reward = getItemCandidates()
            .find(item => item.name?.trim().toLowerCase() === String(itemName || '').trim().toLowerCase());
        if (!reward) return { success: false, message: `I cannot award ${itemName} because it is not in the available item list.` };
        if (reward.CharacterClass
            && reward.CharacterClass !== 'Any'
            && reward.CharacterClass !== gameState.charClass) {
            return { success: false, message: `The ${reward.name} can only be unlocked by a ${reward.CharacterClass}.` };
        }
        let item = gameState.tools.find(tool => tool.name?.trim().toLowerCase() === reward.name.trim().toLowerCase());
        if (!item) {
            item = { ...reward };
            gameState.tools.push(item);
        }
        item.unlocked = true;
        emitInventoryUpdate(gameState.tools);
        return { success: true, item: item.name };
    }

    function getRandomAvailableItem() {
        const candidates = getItemCandidates().filter(item =>
            item.name
            && (!item.CharacterClass || item.CharacterClass === 'Any' || item.CharacterClass === gameState.charClass)
            && !gameState.tools.some(tool => tool.name === item.name && tool.unlocked)
        );
        return candidates[Math.floor(Math.random() * candidates.length)] || null;
    }

    function unlockAllItems() {
        const unlocked = [];
        for (const reward of getItemCandidates()) {
            if (!reward?.name || unlocked.includes(reward.name)) continue;
            let item = gameState.tools.find(tool => tool.name?.trim().toLowerCase() === reward.name.trim().toLowerCase());
            if (!item) {
                item = { ...reward };
                gameState.tools.push(item);
            }
            item.unlocked = true;
            unlocked.push(reward.name);
        }
        emitInventoryUpdate(gameState.tools);
        return { success: true, count: unlocked.length };
    }

    function apply(responseText, context = {}) {
        if (typeof responseText !== 'string') return responseText;
        const action = parseGameActionFromText(responseText)
            || (() => {
                const enemy = inferCombatActionFromText(responseText, enemies);
                return enemy ? { name: 'start_combat', enemy: typeof enemy === 'string' ? enemy : enemy.name } : null;
            })();
        if (!action) return responseText;
        console.log('GAME ACTION:', action);

        if (action.name === 'start_combat' && context.allowCombatStart !== false) {
            const result = startCombat(action.enemy, context.conversationId);
            if (!result?.success) {
                console.log('COMBAT NOT STARTED:', result?.message || action.enemy);
            } else {
                context.onCombatStarted?.(result);
            }
        }
        if (action.name === 'unlock_item') {
            const result = unlockItem(action.item);
            if (!result.success) action.failureMessage = result.message;
            else console.log('UNLOCKED ITEM:', result.item);
        }
        // Cleanup how the AI types out the given reward
        const cleanedText = responseText
            .replace(/<ACTION>[\s\S]*?<\/ACTION>/gi, '')
            .replace(/\{\s*"name"\s*:\s*"give_gold"\s*,\s*"amount"\s*:\s*\d+\s*\}/gi, '')
            .replace(/give_gold\s*\(\s*\d+\s*\)/gi, '')
            .replace(/(?:reward|gave|grant|awarded?)\s+\d+\s*(?:gp|gold)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (action.failureMessage) return action.failureMessage;
        if (cleanedText) return cleanedText;
        if (action.name === 'unlock_item') return `You have unlocked the ${action.item}.`;
        if (action.name === 'start_combat') return `Combat begins against ${action.enemy}.`;
        return responseText.trim();
    }
    return { apply, getRandomAvailableItem, unlockAllItems, unlockItem };
}

module.exports = { createGameActionService, inferCombatActionFromText, parseGameActionFromText };
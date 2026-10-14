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
            const reward = (Array.isArray(rewards) ? rewards : [])
                .flatMap(story => story.rewards || [])
                .find(item => item.name?.trim().toLowerCase() === action.item?.trim().toLowerCase());
            if (!reward) {
                console.log('ITEM NOT FOUND:', action.item);
            } else if (reward.CharacterClass !== 'Any'
                && reward.CharacterClass !== gameState.charClass) {
                console.log('ITEM CLASS RESTRICTION:', action.item, reward.CharacterClass, gameState.charClass);
                action.classRestriction = reward.CharacterClass;
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
        if (action.classRestriction) {
            return `The ${action.item} can only be unlocked by a ${action.classRestriction}.`;
        }
        if (cleanedText) return cleanedText;
        if (action.name === 'unlock_item') return `You have unlocked the ${action.item}.`;
        if (action.name === 'start_combat') return `Combat begins against ${action.enemy}.`;
        return responseText.trim();
    }
    return { apply };
}

module.exports = { createGameActionService, inferCombatActionFromText, parseGameActionFromText };
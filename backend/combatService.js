// Roll Calculation
function rollDamage(expression) {
    const match = String(expression || '').match(/^(\d{1,2})d(\d{1,3})([+-]\d{1,4})?$/i);
    if (!match) return null;
    const count = Number(match[1]);
    const sides = Number(match[2]);
    const modifier = Number(match[3] || 0);
    if (count < 1 || sides < 2) return null;
    let total = modifier;
    for (let die = 0; die < count; die += 1) {
        total += Math.floor(Math.random() * sides) + 1;
    }
    return Math.max(0, total);
}

// Initialize Combat
function createCombatService({ gameState, enemies, questionProvider = async () => null, recordCorrectAnswer = () => null, awardExperience = () => {}, awardBossRushLevel = () => null, getProgression = () => null }) {
    let enemy = null;
    let enemyHP = 0;
    let playerHP = Math.max(0, Math.floor(gameState.HP));
    let phase = 'inactive';
    let combatQuestion = null;
    let conversationId = null;
    let combatId = 0;
    let resolvingCombatId = null;
    const bossRush = { active: false, index: 0, enemies: [] };
    const completedResolutions = new Map();

    function start(enemyName, startedInConversation = null) {
        if (phase !== 'inactive') {
            return { success: false, message: 'Combat is already active.' };
        }
        const normalizedName = String(enemyName || '').trim().toLowerCase();
        const selectedEnemy = enemies.find(candidate => candidate.name.trim().toLowerCase() === normalizedName);
        if (!selectedEnemy) {
            return { success: false, message: 'That enemy is not available.' };
        }
        enemy = selectedEnemy;
        enemyHP = enemy.HP;
        playerHP = Math.max(0, Math.floor(gameState.HP));
        phase = 'question';
        combatQuestion = null;
        conversationId = Number(startedInConversation) || null;
        combatId += 1;
        return { success: true, combatId, enemy: enemy.name };
    }

    function startBossRush(startedInConversation = null) {
        if (phase !== 'inactive' || !enemies.length) {
            return { success: false, message: 'A boss rush cannot be started right now.' };
        }
        bossRush.active = true;
        bossRush.index = 0;
        bossRush.enemies = enemies.map(candidate => candidate.name);
        const result = start(bossRush.enemies[0], startedInConversation);
        if (!result.success) {
            bossRush.active = false;
            bossRush.enemies = [];
            return result;
        }
        return { ...result, bossRush: { index: 0, total: bossRush.enemies.length } };
    }

    async function prepareQuestion() {
        if (!enemy || phase !== 'question') return combatQuestion;
        if (!combatQuestion) combatQuestion = await questionProvider();
        return combatQuestion;
    }

    function performEnemyAttack() {
        const attacks = Object.values(enemy.attacks || {});
        if (!attacks.length) return null;
        const attack = attacks[Math.floor(Math.random() * attacks.length)];
        const damage = rollDamage(attack.damage);
        if (damage === null) return null;
        playerHP = Math.max(0, playerHP - damage);
        return { name: attack.header, damage, playerHP };
    }

    function healPlayerToMax() {
        playerHP = Math.max(0, Math.floor(gameState.HP));
        return playerHP;
    }

    function reset() {
        enemy = null;
        enemyHP = 0;
        playerHP = Math.max(0, Math.floor(gameState.HP));
        phase = 'inactive';
        combatQuestion = null;
        conversationId = null;
        resolvingCombatId = null;
        bossRush.active = false;
        bossRush.index = 0;
        bossRush.enemies = [];
        combatId += 1;
        completedResolutions.clear();
    }

    // Answer Question
    function answer(answerId, requestedCombatId) {
        if (Number(requestedCombatId) !== combatId) {
            return { status: 409, body: { success: false, message: 'This combat is no longer active.' } };
        }
        if (!enemy || phase === 'inactive' || phase === 'won' || phase === 'lost') {
            return { status: 409, body: { success: false, message: 'There is no active combat.' } };
        }
        if (phase !== 'question') {
            return { status: 409, body: { success: false, message: 'This question has already been answered.' } };
        }
        if (!combatQuestion || !combatQuestion.answers.some(answerOption => answerOption.id === answerId)) {
            return { status: 400, body: { success: false, message: 'Choose a valid answer.' } };
        }
        const correct = answerId === combatQuestion.correctAnswerId;
        const result = {
            success: true,
            correct,
            correctAnswerId: combatQuestion.correctAnswerId,
            enemyHP,
            playerHP,
            playerMaxHP: gameState.HP,
            canAttack: correct,
            phase: correct ? 'attack' : 'result',
                bossRush: bossRush.active,
            mastery: correct ? recordCorrectAnswer() : null
        };
        if (correct) {
            phase = 'attack';
            return { status: 200, body: result };
        }
        const enemyAttack = performEnemyAttack();
        phase = playerHP <= 0 ? 'lost' : 'result';
        return {
            status: 200,
            body: {
                ...result,
                enemyAttack,
                playerHP,
                phase,
                message: enemyAttack
                    ? `Incorrect. Your turn is skipped. ${enemy.name} uses ${enemyAttack.name} for ${enemyAttack.damage} damage.`
                    : 'Incorrect. Your turn is skipped.'
            }
        };
    }

    // Attack
    function attack(itemName, requestedCombatId) {
        if (Number(requestedCombatId) !== combatId) {
            return { status: 409, body: { success: false, message: 'This combat is no longer active.' } };
        }
        if (!enemy || phase === 'inactive' || phase === 'won' || phase === 'lost') {
            return { status: 409, body: { success: false, message: 'There is no active combat.' } };
        }
        if (phase !== 'attack') {
            return { status: 409, body: { success: false, message: 'You do not have an attack ready.' } };
        }
        const normalizedName = String(itemName || '').trim().toLowerCase();
        const item = gameState.tools.find(tool => tool.unlocked && tool.name.trim().toLowerCase() === normalizedName);
        if (!item || item.class === 'Armor' || item.damage === '0') {
            return { status: 400, body: { success: false, message: 'That item cannot be used to attack.' } };
        }
        const damage = rollDamage(item.damage);
        if (damage === null) {
            return { status: 400, body: { success: false, message: 'That item has an invalid damage roll.' } };
        }
        enemyHP = Math.max(0, enemyHP - damage);
        phase = enemyHP <= 0 ? 'won' : 'result';
        const bossRushLevelUp = phase === 'won' && bossRush.active && enemy.isBoss === true;
        const xpAwarded = phase === 'won' && !bossRush.active ? Math.max(0, Math.floor(Number(enemy.xpReward) || 0)) : 0;
        let progression = null;
        if (bossRushLevelUp) {
            progression = awardBossRushLevel();
            if (gameState.HP > playerHP) playerHP = Math.floor(gameState.HP);
        } else if (xpAwarded > 0) {
            const previousMaxHP = gameState.HP;
            awardExperience(xpAwarded);
            if (gameState.HP > previousMaxHP) playerHP = Math.floor(gameState.HP);
            progression = getProgression();
        }
        return {
            status: 200,
            body: {
                success: true,
                damage,
                enemyHP,
                playerHP,
                playerMaxHP: gameState.HP,
                xpAwarded,
                progression,
                phase,
                bossRush: bossRush.active,
                message: enemyHP <= 0
                    ? `${item.name} deals ${damage} damage. ${enemy.name} is defeated!${bossRushLevelUp ? ' You gain one level!' : xpAwarded ? ` You gain ${xpAwarded} XP.` : ''}`
                    : `${item.name} deals ${damage} damage.`
            }
        };
    }
    
    async function continueCombat(requestedCombatId) {
        if (Number(requestedCombatId) !== combatId) {
            return { status: 409, body: { success: false, message: 'This combat is no longer active.' } };
        }
        if (phase !== 'result') {
            return { status: 409, body: { success: false, message: 'Combat cannot continue yet.' } };
        }
        let nextQuestion;
        try {
            nextQuestion = await questionProvider();
        } catch (error) {
            console.error('Unable to load the next Quizbank question:', error);
            return { status: 503, body: { success: false, message: 'Unable to load the next course question. Please try again.' } };
        }
        if (!nextQuestion) {
            return { status: 503, body: { success: false, message: 'There are no more mastery units to question.' } };
        }
        combatQuestion = nextQuestion;
        phase = 'question';
        return { status: 200, body: { success: true, enemyHP, playerHP, playerMaxHP: gameState.HP, question: getPublicQuestion(combatQuestion) } };
    }

    function canResolve(requestedCombatId, requestedConversationId) {
        const id = Number(requestedCombatId);
        const requestedConversation = Number(requestedConversationId) || null;
        return Boolean(enemy)
            && id === combatId
            && (phase === 'won' || phase === 'lost')
            && requestedConversation === conversationId;
    }

    function beginResolution(requestedCombatId, requestedConversationId) {
        if (resolvingCombatId !== null || !canResolve(requestedCombatId, requestedConversationId)) return null;
        resolvingCombatId = Number(requestedCombatId);
        return getSnapshot();
    }

    function cancelResolution(requestedCombatId) {
        if (resolvingCombatId !== Number(requestedCombatId)) return false;
        resolvingCombatId = null;
        return true;
    }

    function close(requestedCombatId, responseText) {
        if (Number(requestedCombatId) !== combatId || resolvingCombatId !== combatId || (phase !== 'won' && phase !== 'lost')) return false;
        const resolvedPhase = phase;
        const wasBossRush = bossRush.active;
        const resolvedConversationId = conversationId;
        enemy = null;
        enemyHP = 0;
        phase = 'inactive';
        conversationId = null;
        resolvingCombatId = null;
        let bossRushComplete = false;
        let bossRushLost = false;
        if (wasBossRush && resolvedPhase === 'won') {
            bossRush.index += 1;
            if (bossRush.index >= bossRush.enemies.length) {
                bossRush.active = false;
                bossRushComplete = true;
            } else {
                const nextEnemyName = bossRush.enemies[bossRush.index];
                const carriedPlayerHP = playerHP;
                const nextCombat = start(nextEnemyName, resolvedConversationId);
                if (!nextCombat.success) {
                    bossRush.active = false;
                    bossRush.enemies = [];
                    bossRushComplete = true;
                } else {
                    playerHP = carriedPlayerHP;
                }
            }
        } else if (wasBossRush && resolvedPhase === 'lost') {
            bossRush.active = false;
            bossRushLost = true;
        } else {
            playerHP = Math.max(0, Math.floor(gameState.HP));
        }
        completedResolutions.set(Number(requestedCombatId), {
            conversationId: resolvedConversationId,
            responseText,
            bossRush: wasBossRush,
            bossRushComplete,
            bossRushLost
        });
        return { success: true, bossRush: wasBossRush, bossRushComplete, bossRushLost };
    }

    function advanceBossRush(requestedCombatId) {
        if (!bossRush.active || phase !== 'won' || Number(requestedCombatId) !== combatId) {
            return { success: false, message: 'There is no boss-rush victory to advance.' };
        }
        resolvingCombatId = combatId;
        const result = close(combatId, '');
        if (!result) return { success: false, message: 'The boss-rush encounter could not advance.' };
        return { ...result, combat: getSnapshot() };
    }

    function getCompletedResolution(requestedCombatId, requestedConversationId) {
        const completed = completedResolutions.get(Number(requestedCombatId));
        if (!completed || completed.conversationId !== (Number(requestedConversationId) || null)) return null;
        return completed;
    }

    function getSnapshot() {
        return {
            enemy: enemy || enemies[0],
            enemyHP,
            playerHP,
            playerMaxHP: gameState.HP,
            phase,
            active: Boolean(enemy),
            combatId,
            conversationId,
            question: getPublicQuestion(combatQuestion),
            bossRush: {
                active: bossRush.active,
                index: bossRush.index,
                total: bossRush.enemies.length
            }
        };
    }

    function getPublicQuestion(question) {
        if (!question) return { prompt: '', answers: [] };
        return {
            id: question.id,
            prompt: question.prompt,
            answers: question.answers,
            courseId: question.courseId,
            courseName: question.courseName,
            unitId: question.unitId,
            unitName: question.unitName
        };
    }

    return { answer, attack, advanceBossRush, beginResolution, canResolve, cancelResolution, close, continueCombat, getCompletedResolution, getSnapshot, healPlayerToMax, prepareQuestion, reset, start, startBossRush };
}

module.exports = { createCombatService };
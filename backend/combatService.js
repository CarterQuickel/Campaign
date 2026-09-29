const combatQuestion = {
    id: 'javascript-web-page-task',
    prompt: 'Which task is JavaScript BEST suited to perform on a web page?',
    answers: [
        { id: 'html-layout', text: 'Creating the HTML page layout' },
        { id: 'validate-form', text: 'Validating form input before submission' },
        { id: 'css-colors', text: 'Defining CSS color schemes' },
        { id: 'register-domain', text: 'Registering a domain name' }
    ],
    correctAnswerId: 'validate-form'
};

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
function createCombatService({ gameState, enemies }) {
    const enemy = enemies[Math.floor(Math.random() * enemies.length)];
    let enemyHP = enemy.HP;
    let playerHP = Math.max(0, Math.floor(gameState.HP));
    let phase = 'question';

    function performEnemyAttack() {
        const attacks = Object.values(enemy.attacks || {});
        if (!attacks.length) return null;
        const attack = attacks[Math.floor(Math.random() * attacks.length)];
        const damage = rollDamage(attack.damage);
        if (damage === null) return null;
        playerHP = Math.max(0, playerHP - damage);
        return { name: attack.header, damage, playerHP };
    }

    // Answer Question
    function answer(answerId) {
        if (phase !== 'question') {
            return { status: 409, body: { success: false, message: 'This question has already been answered.' } };
        }
        if (!combatQuestion.answers.some(answerOption => answerOption.id === answerId)) {
            return { status: 400, body: { success: false, message: 'Choose a valid answer.' } };
        }
        const correct = answerId === combatQuestion.correctAnswerId;
        const result = { success: true, correct, correctAnswerId: combatQuestion.correctAnswerId, enemyHP, playerHP, canAttack: correct };
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
    function attack(itemName) {
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
        const enemyAttack = enemyHP > 0 ? performEnemyAttack() : null;
        phase = enemyHP <= 0 ? 'won' : playerHP <= 0 ? 'lost' : 'result';
        return {
            status: 200,
            body: {
                success: true,
                damage,
                enemyHP,
                playerHP,
                enemyAttack,
                phase,
                message: enemyHP <= 0
                    ? `${item.name} deals ${damage} damage. ${enemy.name} is defeated!`
                    : `${item.name} deals ${damage} damage.${enemyAttack ? ` ${enemy.name} uses ${enemyAttack.name} for ${enemyAttack.damage} damage.` : ''}`
            }
        };
    }
    function continueCombat() {
        if (phase !== 'result') {
            return { status: 409, body: { success: false, message: 'Combat cannot continue yet.' } };
        }
        phase = 'question';
        return { status: 200, body: { success: true, enemyHP, playerHP } };
    }
    function getSnapshot() {
        return { enemy, enemyHP, playerHP, phase, question: combatQuestion };
    }
    return { answer, attack, continueCombat, getSnapshot };
}

module.exports = { createCombatService };
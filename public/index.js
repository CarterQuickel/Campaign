async function renderAIResponse(text) {
    const source = document.getElementById('ai-response');
    const container = document.getElementById('chat');
    if (!source || !container) {
        return;
    }
    container.hidden = false;
    const chatContainer = document.getElementById('text-scroll');
    // create assistant message bubble
    const msgWrap = document.createElement('div');
    msgWrap.className = 'message assistant';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    msgWrap.appendChild(bubble);
    if (chatContainer) chatContainer.appendChild(msgWrap);
    const action = parseGameActionFromText(text);
    const actionAmount = action && action.name === 'give_gold' ? Number(action.amount ?? 0) : 0;
    const cleanedText = text
        .replace(/<ACTION>\s*[\s\S]*?\s*<\/ACTION>/gi, '')
        .replace(/\{\s*"name"\s*:\s*"give_gold"\s*,\s*"amount"\s*:\s*\d+\s*\}/gi, '')
        .replace(/give_gold\s*\(\s*\d+\s*\)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    const fallbackText = actionAmount > 0 ? `You receive ${actionAmount} gold.` : '';
    const displayText = cleanedText || fallbackText || 'The DM responds.';
    await applyGameActionFromText(text);
    await typeAIResponseIntoElement(displayText, bubble);
    source.hidden = true;
    // scroll to bottom
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
}

const responseElement = document.getElementById('ai-response');
if (responseElement) {
    renderAIResponse(responseElement.textContent);
}

// update gold
function updateGoldDisplay(amount) {
    const goldDisplay = document.getElementById('goldDisplay');
    if (!goldDisplay) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount)) return;
    goldDisplay.dataset.gold = parsedAmount;
    goldDisplay.textContent = `◈ ${parsedAmount}gp`;
}

// action
function parseGameActionFromText(text) {
    if (typeof text !== 'string') return null;
    const tagMatch = text.match(/<ACTION>\s*([\s\S]*?)\s*<\/ACTION>/i);
    if (tagMatch) {
        try {
            const parsed = JSON.parse(tagMatch[1]);
            if (parsed && parsed.name === 'give_gold') {
                return { name: 'give_gold', amount: Number(parsed.amount ?? parsed.gold_amount ?? 0) };
            }
        } catch (error) {
            console.error('Unable to parse action tag:', error);
        }
    }
    const directJsonMatch = text.match(/\{\s*"name"\s*:\s*"give_gold"\s*,\s*"amount"\s*:\s*(\d+)\s*\}/i);
    if (directJsonMatch) {
        return { name: 'give_gold', amount: Number(directJsonMatch[1]) };
    }
    const functionMatch = text.match(/give_gold\s*\(\s*(\d+)\s*\)/i);
    if (functionMatch) {
        return { name: 'give_gold', amount: Number(functionMatch[1]) };
    }
    const goldTextMatch = text.match(/(?:reward|gave|grant|awarded?)\s+(\d+)\s*(?:gp|gold)/i);
    if (goldTextMatch) {
        return { name: 'give_gold', amount: Number(goldTextMatch[1]) };
    }
    return null;
}
async function applyGameActionFromText(text) {
    const action = parseGameActionFromText(text);
    if (!action || action.name !== 'give_gold') return false;
    const amount = Number(action.amount ?? 0);
    if (!Number.isFinite(amount) || amount === 0) return false;
    try {
        const response = await fetch('/api/game/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action.name, amount })
        });
        const result = await response.json();
        if (response.ok && result && Number.isFinite(Number(result.gold))) {
            updateGoldDisplay(result.gold);
        }
    } catch (error) {
        console.error('Unable to apply the AI action:', error);
    }
    return true;
}

//update chat boxes
function typeAIResponseIntoElement(text, element, speed = 15) {
    let index = 0;
    document.getElementById("chatbox").value = "";
    return new Promise((resolve) => {
        function nextCharacter() {
            if (index >= text.length) {
                resolve();
                return;
            }
            element.textContent += text[index];
            index++;
            setTimeout(nextCharacter, speed);
        }
        nextCharacter();
    });
}

//form submitting
document.addEventListener("keydown", function(event) {
    const form = document.getElementById("txtform");
    const box = document.getElementById("chatbox");
    if (event.target === box && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});

//filter
let filter = 'all';
setTimeout(() => {
    const filterButtons = document.querySelectorAll('.cate');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filter = button.getAttribute('data-category');
            button.classList.add('active');
            filterButtons.forEach(btn => {
                if (btn !== button) {
                    btn.classList.remove('active');
                }
            });
            filterTools(filter);
        });
    });
}, 100);
function filterTools(filter) {
    const tools = document.querySelectorAll('.tool');
    tools.forEach(tool => {
        const toolClass = tool.getAttribute('data-class');
        const isUnlocked = tool.getAttribute('data-unlocked') === 'true';
        if ((filter === 'all' || toolClass === filter) && isUnlocked) {
            tool.style.display = 'flex';
        } else {
            tool.style.display = 'none';
        }
    });
}

//course panel select
const courseTabs = document.querySelectorAll('.courseCate');
const coursePanels = document.querySelectorAll('.currentPanelCate');
if (courseTabs.length && coursePanels.length) {
    courseTabs.forEach(button => {
        button.addEventListener('click', () => {
            const selectedCategory = button.getAttribute('data-category');
            courseTabs.forEach(tab => {
                tab.classList.toggle('active', tab === button);
            });
            coursePanels.forEach(panel => {
                const isSelected = panel.getAttribute('data-category') === selectedCategory;
                panel.classList.toggle('enabled', isSelected);
                panel.classList.toggle('disabled', !isSelected);
            });
        });
    });
}

//settings panel select
const settingsTabs = document.querySelectorAll('.setting');
const settingsPanels = document.querySelectorAll('.settingCate');
if (settingsTabs.length && settingsPanels.length) {
    settingsTabs.forEach(button => {
        button.addEventListener('click', () => {
            const selectedCategory = button.getAttribute('data-setting');
            settingsTabs.forEach(tab => {
                tab.classList.toggle('active', tab === button);
            });
            settingsPanels.forEach(panel => {
                const isSelected = panel.getAttribute('data-setting') === selectedCategory;
                panel.classList.toggle('enabled', isSelected);
                panel.classList.toggle('disabled', !isSelected);
            });
        });
    });
}

//dice roll
async function rollDiceWithFlicker(sides, mod, unmoddedRoll, roll, resultElement, rolledElement, natElement, modElement) {
    const flickerDuration = 600; // Total flicker time in ms
    const startTime = Date.now();
    let isFlickering = true;
    // Flicker animation
    while (isFlickering) {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / flickerDuration, 1);
        // Calculate flicker speed based on progress (fast at start, slow at end)
        const flickerSpeed = Math.max(50, 300 * progress);
        if (elapsed % flickerSpeed < flickerSpeed / 2) {
            const randomNumber = Math.floor(Math.random() * sides) + 1;
            if (resultElement) {
                resultElement.textContent = `${randomNumber + mod}`;
            }
        }
        if (progress >= 1) {
            isFlickering = false;
        } else {
            await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
        }
    }
    // Show final result
    if (resultElement) {
        resultElement.textContent = `${roll}`;
    }
    // Show the other elements after flicker completes
    // NAT 1
    if (unmoddedRoll === 1) {
        natElement.style.opacity = 1;
    } else {
        natElement.style.opacity = 0;
    }
    // mod
    if (mod !== 0 && modElement) {
        modElement.textContent = `${mod > 0 ? `+` : ``}${mod}`
        modElement.style.opacity = 1;
    } else {
        modElement.style.opacity = 0;
    }
    // dice
    if (rolledElement) {
        rolledElement.textContent = `d${sides} ⟶ ${unmoddedRoll}`;
        rolledElement.style.opacity = 1;
    }
}

//Roll dice
const dice = document.querySelectorAll('.diceBtn');
dice.forEach(die => {
    die.addEventListener('click', async () => {
        const sides = parseInt(die.getAttribute('data-dice'));
        const mod = parseInt(document.getElementById('modInput').value) || 0;
        const unmoddedRoll = Math.floor(Math.random() * sides) + 1
        const roll = unmoddedRoll + mod;
        const resultElement = document.getElementById('diceResult');
        const rolledElement = document.getElementById('rolled');
        const natElement = document.getElementById('nat');
        const modElement = document.getElementById('modResult');
        // Hide the elements before starting flicker
        if (rolledElement) {
            rolledElement.style.opacity = 0;
        }
        if (natElement) {
            natElement.style.opacity = 0;
        }
        if (modElement) {
            modElement.style.opacity = 0;
        }
        // Start flicker animation and wait for it to complete
        await rollDiceWithFlicker(sides, mod, unmoddedRoll, roll, resultElement, rolledElement, natElement, modElement);
    });
});

// Update milestones that the current course has reached.
function updateClaimableMilestones() {
    document.querySelectorAll('.milestone').forEach(milestoneList => {
        const courseProgress = Number(milestoneList.dataset.courseProgress);
        if (!Number.isFinite(courseProgress)) return;
        milestoneList.querySelectorAll('.section').forEach(milestone => {
            const requiredProgress = Number.parseInt(
                milestone.querySelector('.secPerc')?.textContent,
                10
            );
            const isClaimable = Number.isFinite(requiredProgress)
                && courseProgress >= requiredProgress
                && milestone.dataset.claimed !== 'true';
            const isClaimed = milestone.dataset.claimed === 'true';
            milestone.classList.toggle('claimable', isClaimable);
            milestone.classList.toggle('claimed', isClaimed);
            milestone.setAttribute('aria-disabled', String(isClaimed));
        });
    });
}
updateClaimableMilestones();

// Click on milestone
document.querySelectorAll('.milestone .section').forEach(milestone => {
    milestone.addEventListener('click', async () => {
        if (!milestone.classList.contains('claimable') || milestone.dataset.claimed === 'true') return;
        const requiredProgress = Number.parseInt(
            milestone.querySelector('.secPerc')?.textContent,
            10
        );
        const experience = Number(milestone.dataset.xp);
        milestone.classList.add('claiming');
        try {
            const response = await fetch('/api/course/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requiredProgress, experience })
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Unable to claim milestone.');
            }
            milestone.dataset.claimed = 'true';
            milestone.classList.remove('claimable');
            milestone.classList.add('claimed');
            milestone.querySelector('.secPercent').textContent = 'CLAIMED';
            const weightTxt = document.getElementById('xpTxt');
            const encumbar = document.getElementById('xpprogress');
            const levelTxt = document.getElementById('levelTxt');
            const levelBannerTxt = document.getElementById('level');
            if (weightTxt) weightTxt.textContent = `${result.xp}/${result.maxXp} XP`;
            if (encumbar) encumbar.value = result.xp;
            if (levelTxt) levelTxt.textContent = `Level ${result.level}`;
            if (levelBannerTxt) levelBannerTxt.textContent = result.level;
        } catch (error) {
            console.error('Unable to claim milestone:', error);
        } finally {
            milestone.classList.remove('claiming');
        }
    });
});

// Combat
const combatOverlay = document.getElementById('combatOverlay');
const combatStatus = document.getElementById('combatStatus');
const combatMessage = document.getElementById('combatMessage');
const attackItems = document.getElementById('attackItems');
const combatContinue = document.getElementById('combatContinue');
const answerOptions = [...document.querySelectorAll('.answerOption')];

function updateCombatVitals(result) {
    if (Number.isFinite(Number(result.enemyHP))) {
        const enemyHPBar = document.getElementById('enemyHPBar');
        const enemyHPText = document.getElementById('enemyHPText');
        if (enemyHPBar) enemyHPBar.value = Number(result.enemyHP);
        if (enemyHPText && enemyHPBar) {
            enemyHPText.textContent = `${result.enemyHP}/${enemyHPBar.max} HP`;
        }
    }
    if (Number.isFinite(Number(result.playerHP))) {
        const playerHPDisplay = document.getElementById('playerHPDisplay');
        if (playerHPDisplay) {
            const maxHP = playerHPDisplay.textContent.trim().split('/')[1];
            playerHPDisplay.textContent = `${result.playerHP}/${maxHP}`;
        }
    }
}

function showCombatPanel({ correct, message = '', showAttacks = false, phase = 'result' }) {
    if (!combatOverlay) return;
    combatOverlay.classList.add('open');
    combatOverlay.setAttribute('aria-hidden', 'false');
    combatStatus.textContent = phase === 'won' ? 'Victory!' : phase === 'lost' ? 'Defeated' : correct ? 'Correct!' : 'Incorrect!';
    combatStatus.classList.toggle('correct', Boolean(correct));
    combatStatus.classList.toggle('incorrect', !correct);
    combatMessage.textContent = message;
    attackItems.hidden = !showAttacks;
    combatContinue.hidden = showAttacks;
    combatOverlay.dataset.phase = phase;
    combatContinue.disabled = false;
    combatContinue.textContent = phase === 'won' ? 'Claim Rewards and Continue' : 'Continue';
}

answerOptions.forEach(button => {
    button.addEventListener('click', async () => {
        answerOptions.forEach(option => { option.disabled = true; });
        try {
            const response = await fetch('/api/combat/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answerId: button.dataset.answerId })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Unable to submit answer.');

            answerOptions.forEach(option => {
                const isCorrectAnswer = option.dataset.answerId === result.correctAnswerId;
                const isSelected = option === button;
                option.classList.toggle('active', isCorrectAnswer || isSelected);
                option.classList.toggle('correct', isCorrectAnswer);
                option.classList.toggle('incorrect', isSelected && !result.correct);
                option.querySelector('.selectedAns').textContent = isCorrectAnswer ? '✓' : isSelected ? '×' : '';
            });
            updateCombatVitals(result);
            showCombatPanel({
                correct: result.correct,
                message: result.message || (result.correct ? 'Choose a weapon to attack with.' : 'Your turn is skipped.'),
                showAttacks: result.canAttack,
                phase: result.phase
            });
        } catch (error) {
            console.error('Unable to submit combat answer:', error);
            answerOptions.forEach(option => { option.disabled = false; });
        }
    });
});

document.querySelectorAll('#attackItems .selectable').forEach(button => {
    button.addEventListener('click', async () => {
        document.querySelectorAll('#attackItems .selectable').forEach(option => { option.disabled = true; });
        try {
            const response = await fetch('/api/combat/attack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemName: button.dataset.name })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Unable to attack.');
            updateCombatVitals(result);
            showCombatPanel({
                correct: true,
                message: result.message,
                phase: result.phase
            });
        } catch (error) {
            console.error('Unable to use attack:', error);
            document.querySelectorAll('#attackItems .selectable').forEach(option => { option.disabled = false; });
        }
    });
});

combatContinue?.addEventListener('click', async () => {
    try {
        if (combatOverlay.dataset.phase === 'result') {
            const response = await fetch('/api/combat/continue', { method: 'POST' });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Unable to return to the question.');
            updateCombatVitals(result);
        }
        combatOverlay.classList.remove('open');
        combatOverlay.setAttribute('aria-hidden', 'true');
        if (combatOverlay.dataset.phase === 'won') {
            const questionPanel = document.getElementById('questionPanel');
            const chatPanel = document.getElementById('chat');
            const centerPanel = document.querySelector('.centerCont');
            if (questionPanel) questionPanel.style.display = 'none';
            if (typeof viewMobilePage === 'function' && window.matchMedia('(max-width: 767px)').matches) {
                viewMobilePage('chat');
            } else {
                if (centerPanel) centerPanel.style.display = 'flex';
                if (chatPanel) chatPanel.style.display = 'flex';
            }
        }
        answerOptions.forEach(option => {
            option.disabled = false;
            option.classList.remove('active', 'correct', 'incorrect');
            option.querySelector('.selectedAns').textContent = '';
        });
        document.querySelectorAll('#attackItems .selectable').forEach(option => { option.disabled = false; });
    } catch (error) {
        console.error('Unable to continue combat:', error);
    }
});

//backend-authoritative equipment weight
const encumCont = document.getElementById('encumCont');
const maxWeight = Number(encumCont?.dataset.maxWeight);
function updateWeightDisplay(weight) {
    const weightTxt = document.getElementById('weightTxt');
    const encumbar = document.getElementById('encumbar');
    if (weightTxt) weightTxt.textContent = `${weight}/${maxWeight} lb`;
    if (encumbar) encumbar.value = weight;
    if (encumCont) encumCont.dataset.currentWeight = weight;
}
document.querySelectorAll('.toolsContainer .tool').forEach(card => {
    const button = card.querySelector('.tool-equip-btn');
    if (!button) return;
    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            const response = await fetch('/api/inventory/equip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: card.dataset.name })
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Unable to equip item.');
            }
            updateWeightDisplay(result.weight);
            result.tools.forEach(item => {
                const itemCard = [...document.querySelectorAll('.toolsContainer .tool')]
                    .find(candidate => candidate.dataset.name === item.name);
                if (!itemCard) return;

                itemCard.dataset.equipped = String(item.equipped);
                itemCard.classList.toggle('equipped', item.equipped);
                const itemButton = itemCard.querySelector('.tool-equip-btn');
                if (itemButton) itemButton.textContent = item.equipped ? 'Unequip' : 'Equip';
            });
        } catch (error) {
            console.error('Unable to equip item:', error);
        } finally {
            button.disabled = false;
        }
    });
});
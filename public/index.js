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

function appendChatMessage(role, text, animate = false, combatPrompt = null) {
    const container = document.getElementById('text-scroll');
    if (!container) return null;
    const wrapper = document.createElement('div');
    wrapper.className = `message ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    const addCombatPrompt = () => {
        if (role !== 'assistant' || !combatPrompt) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'encounterPrompt';
        button.textContent = 'Enter Encounter';
        bubble.appendChild(button);
    };
    if (animate) {
        return typeAIResponseIntoElement(String(text), bubble).then(() => {
            addCombatPrompt();
            container.scrollTop = container.scrollHeight;
            return wrapper;
        });
    }
    bubble.textContent = String(text);
    addCombatPrompt();
    container.scrollTop = container.scrollHeight;
    return wrapper;
}

function setActiveConversation(conversationId) {
    const idInput = document.getElementById('conversation-id');
    if (idInput) idInput.value = conversationId;
    localStorage.setItem('charmaConversationId', String(conversationId));
    const url = new URL(window.location.href);
    url.searchParams.set('conversationId', conversationId);
    window.history.replaceState({}, '', url);
}

async function createConversation(title) {
    const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to start a conversation.');
    setActiveConversation(data.conversationId);
    return data.conversationId;
}

async function resumePendingConversation(conversationId, pendingBubble) {
    const container = document.getElementById('text-scroll');
    for (let attempt = 0; attempt < 120; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        try {
            const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`);
            if (!response.ok) break;
            const data = await response.json();
            const messages = data.messages || [];
            const lastMessage = messages[messages.length - 1];
            const precedingMessage = messages[messages.length - 2];
            const isCurrentReply = lastMessage?.role === 'assistant'
                && precedingMessage?.role === 'user'
                && (!data.pendingPrompt || precedingMessage.content === data.pendingPrompt);
            if (isCurrentReply) {
                pendingBubble?.remove();
                if (data.combat) updateCombatSnapshot(data.combat);
                await appendChatMessage('assistant', lastMessage.content, true, data.combat);
                return;
            }
            if (!data.pending) break;
        } catch (error) {
            console.error('Unable to resume the pending response:', error);
            break;
        }
    }
    pendingBubble?.remove();
    if (container) container.scrollTop = container.scrollHeight;
}

const chatForm = document.getElementById('txtform');
if (chatForm) {
    const chatboxInput = document.getElementById('chatbox');
    const submitButton = document.getElementById('submit-btn');
    const originalSubmitButton = submitButton?.innerHTML || '';
    const chatContainer = document.getElementById('text-scroll');
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

    const activeConversationId = document.getElementById('conversation-id')?.value;
    const lastMessage = chatContainer?.lastElementChild;
    if (activeConversationId && chatContainer?.dataset.responsePending === 'true') {
        const pending = appendChatMessage('assistant', 'Charma is thinking…');
        resumePendingConversation(activeConversationId, pending);
    }

    chatForm.addEventListener('submit', async event => {
        event.preventDefault();
        const prompt = chatboxInput.value.trim();
        if (!prompt || submitButton.disabled) return;

        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="bounce">.</span><span class="bounce">.</span><span class="bounce">.</span>';
        try {
            let conversationId = document.getElementById('conversation-id').value;
            if (!conversationId) conversationId = await createConversation(prompt);
            appendChatMessage('user', prompt);
            chatboxInput.value = '';

            const response = await fetch('/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ prompt, conversationId })
            });
            const data = await response.json();
            if (data.conversationId) setActiveConversation(data.conversationId);
            if (data.response) {
                if (data.combat) updateCombatSnapshot(data.combat);
                await appendChatMessage('assistant', data.response, true, data.combat);
            }
            else if (!response.ok) throw new Error(data.message || 'The response could not be loaded.');
        } catch (error) {
            appendChatMessage('assistant', `Unable to send your message: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalSubmitButton;
            chatboxInput.focus();
        }
    });
}

const responseElement = document.getElementById('ai-response');
if (responseElement) {
    renderAIResponse(responseElement.textContent);
}

// action
function parseGameActionFromText(text) {
    if (typeof text !== 'string') return null;
    const tagMatch = text.match(/<ACTION>\s*([\s\S]*?)\s*<\/ACTION>/i);
    if (tagMatch) {
        try {
            const parsed = JSON.parse(tagMatch[1]);
            if (parsed?.name === 'unlock_item') {
                return { name: 'unlock_item', item: String(parsed.item || '').trim() };
            }
            if (parsed?.name === 'start_combat') {
                return { name: 'start_combat', enemy: String(parsed.enemy || '').trim() };
            }
        } catch (error) {
            console.error('Unable to parse action tag:', error);
        }
    }
    return null;
}
async function applyGameActionFromText(text) {
    const action = parseGameActionFromText(text);
    if (!action || !['give_gold', 'unlock_item'].includes(action.name)) return false;
    const amount = Number(action.amount ?? 0);
    if (action.name === 'give_gold' && (!Number.isFinite(amount) || amount === 0)) return false;
    if (action.name === 'unlock_item' && !action.item) return false;
    try {
        const response = await fetch('/api/game/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action.name, amount, item: action.item })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'The game action failed.');
    } catch (error) {
        console.error('Unable to apply the AI action:', error);
    }
    return true;
}

//update chat boxes
function typeAIResponseIntoElement(text, element, speed = 15) {
    let index = 0;
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
async function refreshAccountPanel() {
    const accountPanel = document.querySelector('.settingCate[data-setting="account"]');
    if (!accountPanel) return;
    try {
        const response = await fetch('/api/account-summary');
        if (!response.ok) return;
        const { formbarName, accountSummary } = await response.json();
        const list = items => items.length
            ? items.map(item => `<div class="accountItem">${escapeHtml(item)}</div>`).join('')
            : '<div class="accountEmpty">None saved.</div>';
        accountPanel.querySelector('.accountStatus').innerHTML = `Formbar name: <strong>${escapeHtml(formbarName || 'Unknown')}</strong>`;
        accountPanel.querySelector('.accountSummary').innerHTML = `
            <div class="accountSummaryTitle">CHARACTER</div>
            <div class="accountSummaryGrid">
                <div><span>Name</span><strong>${escapeHtml(accountSummary.characterName)}</strong></div>
                <div><span>Class</span><strong>${escapeHtml(accountSummary.characterClass)}</strong></div>
                <div><span>Race</span><strong>${escapeHtml(accountSummary.characterRace)}</strong></div>
                <div><span>Level</span><strong>${accountSummary.level}</strong></div>
                <div><span>HP</span><strong>${accountSummary.hp}</strong></div>
                <div><span>XP</span><strong>${accountSummary.xp}/${accountSummary.maxXp}</strong></div>
            </div>
            <div class="accountSummaryTitle">INVENTORY</div><div class="accountItemList">${list(accountSummary.inventoryItems)}</div>`
    } catch (error) {
        console.error('Unable to refresh account summary:', error);
    }
}
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}
if (settingsTabs.length && settingsPanels.length) {
    settingsTabs.forEach(button => {
        button.addEventListener('click', () => {
            const selectedCategory = button.getAttribute('data-setting');
            if (selectedCategory === 'account') refreshAccountPanel();
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

document.getElementById('restartCampaignBtn')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    if (!window.confirm('Restart the campaign? This will erase your character progress and saved conversations.')) return;
    button.disabled = true;
    try {
        const response = await fetch('/api/campaign/restart', { method: 'POST' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Unable to restart the campaign.');
        window.location.assign('/');
    } catch (error) {
        console.error('Unable to restart campaign:', error);
        window.alert(error.message || 'Unable to restart the campaign.');
        button.disabled = false;
    }
});

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
            const xpTxt = document.getElementById('xpTxt');
            const encumbar = document.getElementById('xpprogress');
            const levelTxt = document.getElementById('levelTxt');
            const levelBannerTxt = document.getElementById('level');
            if (xpTxt) xpTxt.textContent = `${result.xp}/${result.maxXp} XP`;
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
const answerContainer = document.querySelector('.answerCont');

function getAnswerOptions() {
    return [...document.querySelectorAll('.answerOption')];
}

function renderCombatQuestion(question) {
    if (!question) return;
    const prompt = document.querySelector('#questionPanel .question');
    if (prompt) prompt.textContent = question.prompt || '';
    if (!answerContainer) return;
    answerContainer.replaceChildren(...(question.answers || []).map(answer => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'answerOption';
        button.dataset.answerId = String(answer.id);
        const text = document.createElement('span');
        text.className = 'optionTxt';
        text.textContent = answer.text;
        const selected = document.createElement('span');
        selected.className = 'selectedAns';
        selected.setAttribute('aria-hidden', 'true');
        button.append(text, selected);
        return button;
    }));
}

function updateMasteryDisplay(mastery) {
    if (!mastery) return;
    document.querySelectorAll(`.mastery-unit[data-unit-id="${mastery.unitId}"]`).forEach(unit => {
        unit.dataset.completion = mastery.completion;
        const percent = unit.querySelector('.secPercent');
        if (percent) percent.textContent = `${mastery.completion}%`;
    });
    document.querySelectorAll(`.slice[data-unit-id="${mastery.unitId}"]`).forEach(slice => {
        slice.style.setProperty('--radius', `${mastery.completion}%`);
    });

    document.querySelectorAll('.mastery-unit').forEach(unit => {
        const isCurrent = mastery.currentUnit
            && Number(unit.dataset.unitId) === Number(mastery.currentUnit.id)
            && Number(unit.dataset.courseId) === Number(mastery.currentUnit.courseId);
        const mark = unit.querySelector('.mastery-current-mark');
        if (mark) mark.textContent = isCurrent ? '(CURRENT)' : '';
        unit.dataset.current = String(Boolean(isCurrent));
    });

    const currentUnit = mastery.currentUnit;
    const title = document.querySelector('.currentUnitTitle');
    const completion = document.querySelector('.currentUnitCompletion');
    const progress = document.querySelector('.currentUnitProgress');
    const milestones = document.querySelector('.milestone');
    if (currentUnit) {
        if (title) title.textContent = currentUnit.name;
        if (completion) completion.textContent = `${currentUnit.completion}%`;
        if (progress) progress.style.setProperty('--progress', `${currentUnit.completion}%`);
        if (milestones) {
            milestones.dataset.currentUnitId = currentUnit.id;
            milestones.dataset.courseProgress = currentUnit.completion;
        }
    } else {
        if (title) title.textContent = 'All mastery units complete';
        if (completion) completion.textContent = '100%';
        if (progress) progress.style.setProperty('--progress', '100%');
        if (milestones) milestones.dataset.courseProgress = '100';
    }
    updateClaimableMilestones();
}

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
        const playerHPBar = document.getElementById('playerHPBar');
        const playerHPDisplay = document.getElementById('playerHPDisplay');
        if (playerHPBar) {
            if (Number.isFinite(Number(result.playerMaxHP))) playerHPBar.max = Number(result.playerMaxHP);
            playerHPBar.value = Number(result.playerHP);
        }
        if (playerHPDisplay && playerHPBar) {
            playerHPDisplay.textContent = `${result.playerHP}/${playerHPBar.max} HP`;
        }
    }
}

function updateProgressionDisplay(progression) {
    if (!progression) return;
    const xpTxt = document.getElementById('xpTxt');
    const xpProgress = document.getElementById('xpprogress');
    const levelTxt = document.getElementById('levelTxt');
    const levelBanner = document.getElementById('level');
    if (xpTxt) xpTxt.textContent = `${progression.XP}/${progression.MAXXP} XP`;
    if (xpProgress) xpProgress.value = progression.XP;
    if (levelTxt) levelTxt.textContent = `Level ${progression.level}`;
    if (levelBanner) levelBanner.textContent = progression.level;
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
    combatContinue.textContent = combatOverlay.dataset.bossRush === 'true'
        ? phase === 'won' ? 'Next Enemy' : phase === 'lost' ? 'Reset Run' : 'Continue'
        : phase === 'won' || phase === 'lost' ? 'Continue Story' : 'Continue';
}

function returnToChatAfterCombat() {
    const questionPanel = document.getElementById('questionPanel');
    const chatPanel = document.getElementById('chat');
    const centerPanel = document.querySelector('.centerCont');
    if (questionPanel) questionPanel.style.display = 'none';
    document.body.classList.remove('combat-active');
    if (attackItems) attackItems.hidden = true;
    if (combatContinue) combatContinue.hidden = true;
    if (combatOverlay) {
        combatOverlay.classList.remove('open');
        combatOverlay.setAttribute('aria-hidden', 'true');
        combatOverlay.dataset.phase = 'inactive';
        combatOverlay.dataset.combatId = '';
    }
    const combatIdInput = document.getElementById('active-combat-id');
    if (combatIdInput) combatIdInput.value = '';
    if (typeof viewMobilePage === 'function' && window.matchMedia('(max-width: 767px)').matches) {
        viewMobilePage('chat');
    } else {
        if (centerPanel) centerPanel.style.display = 'flex';
        if (chatPanel) chatPanel.style.display = 'flex';
    }
}

function enterNextBossRushCombat(snapshot) {
    updateCombatSnapshot(snapshot);
    document.body.classList.add('combat-active');
    const questionPanel = document.getElementById('questionPanel');
    const chatPanel = document.getElementById('chat');
    const centerPanel = document.querySelector('.centerCont');
    if (window.matchMedia('(max-width: 767px)').matches) {
        if (centerPanel) centerPanel.style.display = 'flex';
        if (questionPanel) questionPanel.style.display = 'flex';
        if (chatPanel) chatPanel.style.display = 'none';
    } else {
        if (questionPanel) questionPanel.style.removeProperty('display');
        if (chatPanel) chatPanel.style.removeProperty('display');
    }
    combatOverlay.classList.remove('open');
    combatOverlay.setAttribute('aria-hidden', 'true');
}

function restoreCombatUI() {
    if (!document.body.classList.contains('combat-active') || !combatOverlay) return;
    const phase = combatOverlay.dataset.phase;
    if (phase === 'attack') {
        showCombatPanel({ correct: true, message: 'Choose a weapon to attack with.', showAttacks: true, phase });
    } else if (phase === 'result') {
        showCombatPanel({ correct: false, message: 'Continue when you are ready for the next question.', phase });
    } else if (phase === 'won' || phase === 'lost') {
        showCombatPanel({
            correct: phase === 'won',
            message: phase === 'won' ? 'Victory! Continue to see what happens next.' : 'Continue to see what happens next.',
            phase
        });
    }
}

function updateCombatSnapshot(snapshot) {
    if (!snapshot || !combatOverlay) return;
    combatOverlay.dataset.phase = snapshot.phase || 'question';
    combatOverlay.dataset.combatId = snapshot.combatId || '';
    combatOverlay.dataset.bossRush = String(Boolean(snapshot.bossRush?.active));
    if (combatContinue) {
        combatContinue.textContent = snapshot.bossRush?.active
            ? snapshot.phase === 'won' ? 'Next Enemy' : snapshot.phase === 'lost' ? 'Reset Run' : 'Continue'
            : 'Continue Story';
    }
    const combatIdInput = document.getElementById('active-combat-id');
    if (combatIdInput) combatIdInput.value = snapshot.combatId || '';
    const enemyName = document.querySelector('.enemyTxt');
    const enemyImage = document.querySelector('.monsterIMG');
    const enemyHPBar = document.getElementById('enemyHPBar');
    if (enemyName && snapshot.enemy?.name) enemyName.textContent = snapshot.enemy.name;
    if (enemyImage && snapshot.enemy?.image) {
        enemyImage.src = snapshot.enemy.image;
        enemyImage.alt = snapshot.enemy.name || '';
    }
    if (enemyHPBar && Number.isFinite(Number(snapshot.enemy?.HP))) enemyHPBar.max = snapshot.enemy.HP;
    renderCombatQuestion(snapshot.question);
    updateCombatVitals(snapshot);
}

document.getElementById('text-scroll')?.addEventListener('click', event => {
    const prompt = event.target.closest('.encounterPrompt');
    if (!prompt) return;
    if (!document.getElementById('active-combat-id')?.value
        || combatOverlay?.dataset.phase === 'inactive') {
        prompt.remove();
        return;
    }
    document.body.classList.add('combat-active');
    const questionPanel = document.getElementById('questionPanel');
    const chatPanel = document.getElementById('chat');
    const centerPanel = document.querySelector('.centerCont');
    if (window.matchMedia('(max-width: 767px)').matches) {
        if (centerPanel) centerPanel.style.display = 'flex';
        if (questionPanel) questionPanel.style.display = 'flex';
        if (chatPanel) chatPanel.style.display = 'none';
    } else {
        if (questionPanel) questionPanel.style.removeProperty('display');
        if (chatPanel) chatPanel.style.removeProperty('display');
    }
    restoreCombatUI();
});

answerContainer?.addEventListener('click', async event => {
        const button = event.target.closest('.answerOption');
        if (!button || button.disabled) return;
        const answerOptions = getAnswerOptions();
        answerOptions.forEach(option => { option.disabled = true; });
        try {
            const response = await fetch('/api/combat/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    answerId: button.dataset.answerId,
                    combatId: document.getElementById('active-combat-id')?.value
                })
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
            updateMasteryDisplay(result.mastery);
            updateCombatVitals(result);
            showCombatPanel({
                correct: result.correct,
                message: result.message || (result.correct ? 'Choose a weapon to attack with.' : 'Your turn is skipped.'),
                showAttacks: result.canAttack,
                phase: result.phase
            });
        } catch (error) {
            console.error('Unable to submit combat answer:', error);
            getAnswerOptions().forEach(option => { option.disabled = false; });
        }
});

document.querySelectorAll('#attackItems .selectable').forEach(button => {
    button.addEventListener('click', async () => {
        document.querySelectorAll('#attackItems .selectable').forEach(option => { option.disabled = true; });
        try {
            const response = await fetch('/api/combat/attack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemName: button.dataset.name,
                    combatId: document.getElementById('active-combat-id')?.value
                })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Unable to attack.');
            updateProgressionDisplay(result.progression);
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
    let continuationBubble = null;
    let endingPhase = null;
    try {
        const phase = combatOverlay.dataset.phase;
        endingPhase = phase;
        if (phase === 'result') {
            const response = await fetch('/api/combat/continue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    combatId: document.getElementById('active-combat-id')?.value
                })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Unable to return to the question.');
            updateCombatVitals(result);
            renderCombatQuestion(result.question);
        } else if (phase === 'won' || phase === 'lost') {
            combatContinue.disabled = true;
            const resolvedCombatId = document.getElementById('active-combat-id')?.value;
            const resolvedConversationId = document.getElementById('conversation-id')?.value;
            if (combatOverlay.dataset.bossRush === 'true') {
                if (phase === 'lost') {
                    const response = await fetch('/api/combat/resolve', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ combatId: resolvedCombatId, conversationId: resolvedConversationId })
                    });
                    const result = await response.json();
                    if (!response.ok || !result.success) throw new Error(result.message || 'Unable to reset the defeated boss rush.');
                    window.location.assign('/');
                    return;
                }
                const response = await fetch('/api/combat/advance-boss-rush', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ combatId: resolvedCombatId })
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.message || 'Unable to advance the boss rush.');
                if (result.combat?.active) {
                    updateCombatSnapshot(result.combat);
                    combatOverlay.classList.remove('open');
                    combatOverlay.setAttribute('aria-hidden', 'true');
                    document.body.classList.add('combat-active');
                    if (window.matchMedia('(max-width: 767px)').matches) {
                        const questionPanel = document.getElementById('questionPanel');
                        const chatPanel = document.getElementById('chat');
                        const centerPanel = document.querySelector('.centerCont');
                        if (centerPanel) centerPanel.style.display = 'flex';
                        if (questionPanel) questionPanel.style.display = 'flex';
                        if (chatPanel) chatPanel.style.display = 'none';
                    }
                    getAnswerOptions().forEach(option => {
                        option.disabled = false;
                        option.classList.remove('active', 'correct', 'incorrect');
                        option.querySelector('.selectedAns').textContent = '';
                    });
                    document.querySelectorAll('#attackItems .selectable').forEach(option => { option.disabled = false; });
                    return;
                }
                returnToChatAfterCombat();
                const chatContainer = document.getElementById('text-scroll');
                const completion = document.createElement('div');
                completion.className = 'message assistant';
                completion.innerHTML = '<div class="bubble">Boss Rush complete! You defeated every enemy.</div>';
                chatContainer?.appendChild(completion);
                if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
                return;
            }
            returnToChatAfterCombat();
            const chatContainer = document.getElementById('text-scroll');
            const enemyName = document.querySelector('.enemyTxt')?.textContent.trim() || 'the enemy';
            const message = document.createElement('div');
            message.className = 'message assistant';
            continuationBubble = document.createElement('div');
            continuationBubble.className = 'bubble';
            continuationBubble.textContent = phase === 'won'
                ? `With ${enemyName} defeated, the aftermath unfolds...`
                : `Defeated by ${enemyName}, you face the consequences...`;
            message.appendChild(continuationBubble);
            chatContainer?.appendChild(message);
            if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
            const response = await fetch('/api/combat/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    combatId: resolvedCombatId,
                    conversationId: resolvedConversationId
                })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Unable to continue the story.');
            updateCombatVitals(result);
            continuationBubble.textContent = '';
            const fallbackText = phase === 'won'
                ? `${enemyName} has fallen. What happens next is yours to decide.`
                : `${enemyName} has overcome you, but this is not necessarily the end. What do you do next?`;
            await typeAIResponseIntoElement(result.response || fallbackText, continuationBubble);
            if (result.bossRushLost) {
                continuationBubble.textContent += ' Your boss rush is over; your campaign progress has been reset.';
                window.location.assign('/');
                return;
            }
            if (result.bossRush && result.combat?.active && result.combat.bossRush?.active) {
                enterNextBossRushCombat(result.combat);
            } else {
                document.querySelectorAll('.encounterPrompt').forEach(button => button.remove());
                if (result.bossRushComplete) {
                    continuationBubble.textContent += ' Boss Rush complete!';
                }
            }
        }
        if (phase !== 'won' && phase !== 'lost') {
            combatOverlay.classList.remove('open');
            combatOverlay.setAttribute('aria-hidden', 'true');
        }
        if (phase === 'won' || phase === 'lost') combatContinue.disabled = false;
        getAnswerOptions().forEach(option => {
            option.disabled = false;
            option.classList.remove('active', 'correct', 'incorrect');
            option.querySelector('.selectedAns').textContent = '';
        });
        document.querySelectorAll('#attackItems .selectable').forEach(option => { option.disabled = false; });
    } catch (error) {
        console.error('Unable to continue combat:', error);
        if (continuationBubble) {
            continuationBubble.textContent = `The story could not continue right now: ${error.message}.`;
            if (endingPhase === 'won' || endingPhase === 'lost') {
                document.body.classList.add('combat-active');
                showCombatPanel({
                    correct: endingPhase === 'won',
                    message: `${error.message} Select Continue Story to retry.`,
                    phase: endingPhase
                });
            }
        } else if (combatContinue) {
            combatContinue.disabled = false;
            combatMessage.textContent = error.message;
        }
    }
});

restoreCombatUI();
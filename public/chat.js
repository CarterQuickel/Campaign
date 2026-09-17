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

//filter
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
//course panel select
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

//add weight
const maxWeight = 100;
const encumCont = document.getElementById('encumCont');
let currentWeight = parseInt(encumCont?.getAttribute('data-current-weight'));
function updateWeightDisplay() {
    const weightTxt = document.getElementById('weightTxt');
    const encumbar = document.getElementById('encumbar');
    
    if (weightTxt) weightTxt.textContent = `${currentWeight}/${maxWeight} lb`;
    if (encumbar) encumbar.value = currentWeight;
    if (encumCont) encumCont.setAttribute('data-current-weight', currentWeight);
}
updateWeightDisplay();
const tools = document.querySelectorAll('.tool');
tools.forEach(tool => {
    const btn = tool.querySelector('.tool-equip-btn');
    btn.addEventListener('click', () => {
        const toolWeight = parseInt(tool.getAttribute('data-weight')) || 0;
        tool.classList.toggle('equipped');
        if (tool.classList.contains('equipped')) {
            currentWeight += toolWeight;
            btn.textContent = 'Equipped';
        } else {
            currentWeight -= toolWeight;
            btn.textContent = 'Equip';
        }
        updateWeightDisplay();
    });
});

//dice roll
const dice = document.querySelectorAll('.diceBtn');
dice.forEach(die => {
    die.addEventListener('click', () => {
        const sides = parseInt(die.getAttribute('data-dice'));
        const mod = parseInt(document.getElementById('modInput').value) || 0;
        const unmoddedRoll = Math.floor(Math.random() * sides) + 1
        const roll = unmoddedRoll + mod;
        const resultElement = document.getElementById('diceResult');
        const rolledElement = document.getElementById('rolled');
        const natElement = document.getElementById('nat');
        const modElement = document.getElementById('modResult');
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
        }
        // result
        if (resultElement) {
            resultElement.textContent = `${roll}`;
        }
    });
});
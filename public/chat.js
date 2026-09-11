async function renderAIResponse(text) {
    const source = document.getElementById('ai-response');
    const container = document.getElementById('chat');
    if (!source || !container) {
        return;
    }
    const rewardRegex = /\[REWARD_BUTTON:(.*?)\|(.*?)\]/g;
    let lastIndex = 0;
    let match;
    container.hidden = false;
    const chatContainer = document.getElementById('text-scroll');
    // create assistant message bubble
    const msgWrap = document.createElement('div');
    msgWrap.className = 'message assistant';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    msgWrap.appendChild(bubble);
    if (chatContainer) chatContainer.appendChild(msgWrap);

    while ((match = rewardRegex.exec(text)) !== null) {
        await typeAIResponseIntoElement(text.slice(lastIndex, match.index), bubble);
        const rewardId = match[2].trim();
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = match[1].trim();
        button.className = 'reward-button';
        button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                const response = await fetch('/api/rewards/claim', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rewardId })
                });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'The reward could not be claimed.');
                }
                button.textContent = 'Reward Claimed';
            } catch (error) {
                button.disabled = false;
                button.textContent = `Claim failed: ${error.message}`;
            }
        });
        msgWrap.appendChild(button);
        lastIndex = rewardRegex.lastIndex;
    }
    await typeAIResponseIntoElement(text.slice(lastIndex), bubble);
    source.hidden = true;
    // scroll to bottom
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
}

const responseElement = document.getElementById('ai-response');
if (responseElement) {
    renderAIResponse(responseElement.textContent);
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
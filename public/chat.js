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
    container.innerHTML = '<h3>Charma:</h3>';
    while ((match = rewardRegex.exec(text)) !== null) {
        await typeAIResponse(text.slice(lastIndex, match.index), container);
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
        container.appendChild(button);
        lastIndex = rewardRegex.lastIndex;
    }
    await typeAIResponse(text.slice(lastIndex), container);
    source.hidden = true;
}

const responseElement = document.getElementById('ai-response');
if (responseElement) {
    renderAIResponse(responseElement.textContent);
}

function typeAIResponse(text, container, speed = 15) {
    const element = document.createTextNode('');
    container.appendChild(element);
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

setTimeout(viewTitle, 100);

function viewTitle() {
    const h1 = document.getElementById("title");
    const chat = document.getElementById("chat");
    if (!h1) {
        return;
    }
    h1.style.display = !chat || chat.hidden ? "block" : "none";
}

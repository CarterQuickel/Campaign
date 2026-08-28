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
    document.getElementById("chatbox");
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

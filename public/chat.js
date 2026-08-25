function renderAIResponse(text) {
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
        container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));

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

    container.appendChild(document.createTextNode(text.slice(lastIndex)));
    source.hidden = true;
}

const responseElement = document.getElementById('ai-response');
if (responseElement) {
    renderAIResponse(responseElement.textContent);
}

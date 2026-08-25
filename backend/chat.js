function renderAIResponse(text) {
    const container = document.querySelector('.chat');
    const rewardRegex = /\[REWARD_BUTTON:(.*?)\|(.*?)\]/g;
    let lastIndex = 0;
    let match;
    while ((match = rewardRegex.exec(text)) !== null) {
        // Add normal AI text before the button
        container.appendChild(
            document.createTextNode(
                text.substring(lastIndex, match.index)
            )
        );
        const buttonText = match[1];
        const rewardId = match[2];
        // Create actual clickable button
        const button = document.createElement('button');
        button.textContent = buttonText;
        button.className = 'reward-button';
        button.addEventListener('click', async () => {
            const response = await fetch('/api/rewards/claim', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rewardId: rewardId
                })
            });
            const result = await response.json();
            if (result.success) {
                button.textContent = '✓ Reward Claimed';
                button.disabled = true;
            }
        });
        container.appendChild(button);
        lastIndex = rewardRegex.lastIndex;
    }
    // Add remaining AI text
    container.appendChild(
        document.createTextNode(text.substring(lastIndex))
    );
    return container;
}
const chatMessage = renderAIResponse(data.response);
document.getElementById('chat').appendChild(chatMessage);
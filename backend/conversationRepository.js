function createConversationRepository(database) {
    const pendingResponses = new Map();

    function getMessages(userId, conversationId) {
        return new Promise((resolve, reject) => {
            database.all(
                `SELECT messages.role, messages.content FROM messages
                 JOIN conversations ON conversations.id = messages.conversation_id
                 WHERE conversations.user_id = ? AND conversations.id = ? ORDER BY messages.id ASC`,
                [userId, conversationId],
                (error, rows) => error ? reject(error) : resolve(rows)
            );
        });
    }

    // Fetch Convo (should be removed later)
    function getRecentMessages(userId, conversationId, limit = 20) {
        return new Promise((resolve, reject) => {
            database.all(
                `SELECT messages.role, messages.content FROM messages
                 JOIN conversations ON conversations.id = messages.conversation_id
                 WHERE conversations.user_id = ? AND conversations.id = ? ORDER BY messages.id DESC LIMIT ?`,
                [userId, conversationId, limit],
                (error, rows) => error ? reject(error) : resolve(rows.reverse())
            );
        });
    }

    // Save Convo
    function saveMessage(userId, conversationId, role, content) {
        return new Promise((resolve, reject) => {
            database.run(
                `INSERT INTO messages (conversation_id, role, content)
                 SELECT id, ?, ? FROM conversations WHERE id = ? AND user_id = ?`,
                [role, content, conversationId, userId],
                error => error ? reject(error) : resolve()
            );
        });
    }

    // Get Convo
    function getConversations(userId) {
        return new Promise((resolve, reject) => {
            database.all('SELECT id, title FROM conversations WHERE user_id = ? ORDER BY id DESC', [userId],
                (error, rows) => error ? reject(error) : resolve(rows));
        });
    }

    function setResponsePending(conversationId, pending, prompt = null) {
        if (pending) pendingResponses.set(Number(conversationId), prompt);
        else pendingResponses.delete(Number(conversationId));
    }

    function isResponsePending(conversationId) {
        return pendingResponses.has(Number(conversationId));
    }

    function getPendingPrompt(conversationId) {
        return pendingResponses.get(Number(conversationId)) || null;
    }

    //Create Convo
    function createConversation(userId, title) {
        return new Promise((resolve, reject) => {
            database.run('INSERT INTO conversations (user_id, title) VALUES (?, ?)', [userId, title], function (error) {
                error ? reject(error) : resolve(this.lastID);
            });
        });
    }
    return {
        createConversation,
        getConversations,
        getMessages,
        getPendingPrompt,
        getRecentMessages,
        isResponsePending,
        saveMessage,
        setResponsePending
    };
}

module.exports = { createConversationRepository };
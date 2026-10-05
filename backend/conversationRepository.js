function createConversationRepository(database) {
    const pendingResponses = new Map();

    function getMessages(conversationId) {
        return new Promise((resolve, reject) => {
            database.all(
                'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC',
                [conversationId],
                (error, rows) => error ? reject(error) : resolve(rows)
            );
        });
    }

    // Fetch Convo (should be removed later)
    function getRecentMessages(conversationId, limit = 20) {
        return new Promise((resolve, reject) => {
            database.all(
                'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?',
                [conversationId, limit],
                (error, rows) => error ? reject(error) : resolve(rows.reverse())
            );
        });
    }

    // Save Convo
    function saveMessage(conversationId, role, content) {
        return new Promise((resolve, reject) => {
            database.run(
                'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
                [conversationId, role, content],
                error => error ? reject(error) : resolve()
            );
        });
    }

    // Get Convo
    function getConversations() {
        return new Promise((resolve, reject) => {
            database.all('SELECT id, title FROM conversations ORDER BY id DESC',
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
    function createConversation(title) {
        return new Promise((resolve, reject) => {
            database.run('INSERT INTO conversations (title) VALUES (?)', [title], function (error) {
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
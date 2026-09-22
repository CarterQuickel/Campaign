const sqlite3 = require('sqlite3').verbose();

function initializeDatabase(dbPath = './chat-history.db') {
    const database = new sqlite3.Database(dbPath);
    database.all('PRAGMA table_info(messages)', (error, columns) => {
        if (error) {
            console.error('Failed to inspect messages schema:', error.message);
            return;
        }
        const hasConversationId = columns.some(column => column.name === 'conversation_id');
        if (!hasConversationId) {
            database.run('ALTER TABLE messages ADD COLUMN conversation_id INTEGER', () => {});
        }
    });
    return database;
}

function getRecentMessages(database, conversationId, limit = 20) {
    return new Promise((resolve, reject) => {
        database.all(
            'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?',
            [conversationId, limit],
            (error, rows) => error ? reject(error) : resolve(rows.reverse())
        );
    });
}

function saveMessage(database, conversationId, role, content) {
    return new Promise((resolve, reject) => {
        database.run(
            'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
            [conversationId, role, content],
            error => error ? reject(error) : resolve()
        );
    });
}

function getConversations(database) {
    return new Promise((resolve, reject) => {
        database.all(
            'SELECT id, title FROM conversations ORDER BY id DESC',
            (error, rows) => error ? reject(error) : resolve(rows)
        );
    });
}

function createConversation(database, title) {
    return new Promise((resolve, reject) => {
        database.run(
            'INSERT INTO conversations (title) VALUES (?)',
            [title],
            function (error) {
                error ? reject(error) : resolve(this.lastID);
            }
        );
    });
}

module.exports = {
    initializeDatabase,
    getRecentMessages,
    saveMessage,
    getConversations,
    createConversation
};

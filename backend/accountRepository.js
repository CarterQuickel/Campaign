function createAccountRepository(database) {
    function run(sql, params = []) {
        return new Promise((resolve, reject) => {
            database.run(sql, params, function (error) {
                if (error) reject(error);
                else resolve(this);
            });
        });
    }

    function get(sql, params = []) {
        return new Promise((resolve, reject) => {
            database.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
        });
    }

    async function ensureAccount(username) {
        await run('INSERT OR IGNORE INTO users (username) VALUES (?)', [username]);
        const account = await get('SELECT id, username FROM users WHERE username = ?', [username]);
        return account;
    }

    async function loadState(accountId) {
        const row = await get('SELECT state_json FROM game_state WHERE user_id = ?', [accountId]);
        return row?.state_json ? JSON.parse(row.state_json) : null;
    }

    async function saveState(accountId, snapshot) {
        await run(`INSERT INTO game_state (user_id, state_json)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json`,
        [accountId, JSON.stringify(snapshot)]);
    }

    return { ensureAccount, loadState, saveState };
}

module.exports = { createAccountRepository };
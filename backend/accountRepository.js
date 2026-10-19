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

    async function createAccount({ username, email, passwordHash }) {
        await run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, passwordHash]);
        return get('SELECT id, username, email, password_hash FROM users WHERE username = ?', [username]);
    }

    function findByLogin(login) {
        return get(`SELECT id, username, email, password_hash
            FROM users WHERE username = ? OR email = ?`, [login, login]);
    }

    function saveResetToken(userId, tokenHash, expiresAt) {
        return run(`UPDATE users
            SET reset_token_hash = ?, reset_token_expires_at = ?
            WHERE id = ?`, [tokenHash, expiresAt, userId]);
    }

    function findByResetToken(tokenHash) {
        return get(`SELECT id, username, email FROM users
            WHERE reset_token_hash = ? AND reset_token_expires_at > CURRENT_TIMESTAMP`, [tokenHash]);
    }

    function updatePassword(userId, passwordHash) {
        return run(`UPDATE users
            SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL
            WHERE id = ?`, [passwordHash, userId]);
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

    return { createAccount, findByLogin, saveResetToken, findByResetToken, updatePassword, loadState, saveState };
}

module.exports = { createAccountRepository };
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataFolderPath = path.resolve(__dirname, '../db');
if (!fs.existsSync(dataFolderPath)) {
    fs.mkdirSync(dataFolderPath, { recursive: true });
}

const dbPath = path.resolve(dataFolderPath, 'database.sqlite');
const initSqlPath = path.resolve(dataFolderPath, 'database.sql');
const schemaSql = fs.readFileSync(initSqlPath, 'utf8');

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error(`Failed to connect to database: ${err.message}`);
                return reject(err);
            }

            // Enable foreign key constraints (required for FOREIGN KEY constraints to be enforced)
            db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
                if (pragmaErr) {
                    console.error(`Failed to enable foreign keys: ${pragmaErr.message}`);
                    db.close();
                    return reject(pragmaErr);
                }

                const normalizedSchemaSql = schemaSql
                    .replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ')
                    .trim();

                db.exec(normalizedSchemaSql, (schemaErr) => {
                    if (schemaErr) {
                        console.error(`Failed to initialize database schema: ${schemaErr.message}`);
                        db.close();
                        return reject(new Error(`Database initialization failed: ${schemaErr.message}`));
                    }

                    console.log('SQLite schema verified with foreign key constraints enabled.');
                    resolve(db);
                });
            });
        });
    });
}

if (require.main === module) {
    initializeDatabase()
        .then((db) => db.close())
        .catch(() => {
            process.exitCode = 1;
        });
}

module.exports = initializeDatabase;
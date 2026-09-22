const express = require('express');
const env = require('dotenv').config();
const { createAppState } = require('./src/appState');
const { initializeDatabase } = require('./src/database');
const { registerRoutes } = require('./src/routes');

const app = express();
const port = 3000;
const IP = process.env.IP_ADDRESS || 'localhost';
const database = initializeDatabase();
const state = createAppState();

registerRoutes(app, { database, state });

app.listen(port, () => console.log(`Server running on ${IP}`));

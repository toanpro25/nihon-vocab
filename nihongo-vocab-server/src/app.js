const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const vocabRoutes = require('./routes/vocab.routes');
const conversationRoutes = require('./routes/conversation.routes');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/vocab', vocabRoutes);
app.use('/api/conversation', conversationRoutes);

// Serve only the frontend entry points and assets, not the whole workspace.
const frontendRoot = path.resolve(__dirname, '../..');
app.get('/', (req, res) => res.sendFile(path.join(frontendRoot, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(frontendRoot, 'index.html')));
app.get('/app.js', (req, res) => res.sendFile(path.join(frontendRoot, 'app.js')));
app.get('/data.js', (req, res) => res.sendFile(path.join(frontendRoot, 'data.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(frontendRoot, 'style.css')));
app.use('/sound', express.static(path.join(frontendRoot, 'sound'), { dotfiles: 'deny' }));

module.exports = app;
const express = require('express');
const { createReply } = require('../services/conversation.service');

const router = express.Router();

router.post('/reply', async (req, res) => {
    const topic = typeof req.body.topic === 'string' ? req.body.topic.trim().slice(0, 100) : '';
    const history = Array.isArray(req.body.history) ? req.body.history : [];

    if (!topic || history.length === 0) {
        return res.status(400).json({ error: 'topic and conversation history are required' });
    }

    const messages = history.slice(-12)
        .filter(message => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
        .map(message => ({ role: message.role, content: message.content.trim().slice(0, 1000) }))
        .filter(message => message.content.length > 0);

    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
        return res.status(400).json({ error: 'conversation history must end with a user message' });
    }

    try {
        const reply = await createReply(topic, messages);
        return res.status(200).json({ reply });
    } catch (error) {
        const status = error.code === 'MISSING_API_KEY' ? 503 : 502;
        console.error('Conversation reply failed:', error.message);
        return res.status(status).json({ error: status === 503 ? 'AI conversation is not configured' : 'Could not generate a reply' });
    }
});

module.exports = router;
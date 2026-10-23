const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// In-memory notification log, keyed by userId. Swap for SNS/SES or a database in production.
const notifications = new Map();
let nextId = 1;

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'notification-service' }));
app.get('/ready', (_req, res) => res.status(200).json({ status: 'ready' }));

app.post('/api/notifications', (req, res) => {
  const { userId, type, message } = req.body || {};
  if (!userId || !type || !message) {
    return res.status(400).json({ error: 'userId, type and message are required' });
  }
  const notification = { id: String(nextId++), userId, type, message, sentAt: new Date().toISOString() };
  const list = notifications.get(userId) || [];
  list.push(notification);
  notifications.set(userId, list);
  console.log(`[notification-service] -> ${userId}: ${type} - ${message}`);
  res.status(201).json(notification);
});

app.get('/api/notifications/:userId', (req, res) => {
  res.json(notifications.get(req.params.userId) || []);
});

app.listen(PORT, () => console.log(`notification-service listening on ${PORT}`));

module.exports = app;

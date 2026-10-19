const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// In-memory store for demo purposes only. Swap for a real database in production.
const users = new Map();
let nextId = 1;

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'user-service' }));
app.get('/ready', (_req, res) => res.status(200).json({ status: 'ready' }));

app.post('/api/users/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }
  if ([...users.values()].some((u) => u.email === email)) {
    return res.status(409).json({ error: 'user already exists' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const id = String(nextId++);
  users.set(id, { id, email, name, passwordHash });
  res.status(201).json({ id, email, name });
});

app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = [...users.values()].find((u) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/api/users/:id', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json({ id: user.id, email: user.email, name: user.name });
});

app.listen(PORT, () => console.log(`user-service listening on ${PORT}`));

module.exports = app;

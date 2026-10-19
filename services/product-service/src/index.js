const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Seed catalog. Swap for a real database in production.
const products = [
  { id: 'p1', name: 'Mechanical Keyboard', price: 89.99, stock: 25 },
  { id: 'p2', name: 'Wireless Mouse', price: 29.99, stock: 50 },
  { id: 'p3', name: '27in Monitor', price: 199.99, stock: 12 },
  { id: 'p4', name: 'USB-C Dock', price: 59.99, stock: 30 },
];

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'product-service' }));
app.get('/ready', (_req, res) => res.status(200).json({ status: 'ready' }));

app.get('/api/products', (_req, res) => res.json(products));

app.get('/api/products/:id', (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'not found' });
  res.json(product);
});

app.listen(PORT, () => console.log(`product-service listening on ${PORT}`));

module.exports = app;

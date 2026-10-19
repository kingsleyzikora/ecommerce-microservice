const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service.product-service.svc.cluster.local:8080';

// In-memory cart store, keyed by userId. Swap for Redis/a database in production.
const carts = new Map();

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'cart-service' }));
app.get('/ready', (_req, res) => res.status(200).json({ status: 'ready' }));

app.get('/api/cart/:userId', (req, res) => {
  res.json(carts.get(req.params.userId) || { userId: req.params.userId, items: [] });
});

app.post('/api/cart/:userId', async (req, res) => {
  const { productId, quantity = 1 } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId is required' });

  try {
    const productRes = await fetch(`${PRODUCT_SERVICE_URL}/api/products/${productId}`);
    if (!productRes.ok) return res.status(404).json({ error: 'product not found' });
    const product = await productRes.json();

    const cart = carts.get(req.params.userId) || { userId: req.params.userId, items: [] };
    const existing = cart.items.find((i) => i.productId === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({ productId, name: product.name, price: product.price, quantity });
    }
    carts.set(req.params.userId, cart);
    res.status(201).json(cart);
  } catch (err) {
    res.status(502).json({ error: 'failed to reach product-service', detail: err.message });
  }
});

app.delete('/api/cart/:userId/:productId', (req, res) => {
  const cart = carts.get(req.params.userId);
  if (!cart) return res.status(404).json({ error: 'cart not found' });
  cart.items = cart.items.filter((i) => i.productId !== req.params.productId);
  res.json(cart);
});

app.listen(PORT, () => console.log(`cart-service listening on ${PORT}`));

module.exports = app;

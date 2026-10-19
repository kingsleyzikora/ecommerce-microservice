const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const CART_SERVICE_URL = process.env.CART_SERVICE_URL || 'http://cart-service.cart-service.svc.cluster.local:8080';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service.notification-service.svc.cluster.local:8080';

// In-memory order store, keyed by userId. Swap for a database in production.
const orders = new Map();
let nextOrderId = 1;

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'order-service' }));
app.get('/ready', (_req, res) => res.status(200).json({ status: 'ready' }));

app.post('/api/orders', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const cartRes = await fetch(`${CART_SERVICE_URL}/api/cart/${userId}`);
    const cart = await cartRes.json();
    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: 'cart is empty' });
    }

    const total = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const order = {
      id: String(nextOrderId++),
      userId,
      items: cart.items,
      total: Math.round(total * 100) / 100,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    const userOrders = orders.get(userId) || [];
    userOrders.push(order);
    orders.set(userId, userOrders);

    // Fire-and-forget notification; order placement should not fail if this is down.
    fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId,
        type: 'ORDER_CONFIRMED',
        message: `Order ${order.id} confirmed for $${order.total}`,
      }),
    }).catch((err) => console.warn('notification-service unreachable:', err.message));

    res.status(201).json(order);
  } catch (err) {
    res.status(502).json({ error: 'failed to reach cart-service', detail: err.message });
  }
});

app.get('/api/orders/:userId', (req, res) => {
  res.json(orders.get(req.params.userId) || []);
});

app.listen(PORT, () => console.log(`order-service listening on ${PORT}`));

module.exports = app;

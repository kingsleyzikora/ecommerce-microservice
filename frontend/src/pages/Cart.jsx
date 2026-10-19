import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Cart({ userId }) {
  const [cart, setCart] = useState({ items: [] });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function refresh() {
    api.getCart(userId).then(setCart).catch((err) => setError(err.message));
  }

  useEffect(refresh, [userId]);

  async function remove(productId) {
    try {
      await api.removeFromCart(userId, productId);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function checkout() {
    try {
      await api.placeOrder(userId);
      navigate('/orders');
    } catch (err) {
      setError(err.message);
    }
  }

  const total = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div>
      <h2>Cart</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {cart.items.map((i) => (
          <li key={i.productId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #ddd' }}>
            <span>{i.name} x {i.quantity} - ${(i.price * i.quantity).toFixed(2)}</span>
            <button onClick={() => remove(i.productId)}>Remove</button>
          </li>
        ))}
      </ul>
      {cart.items.length > 0 && (
        <>
          <p><strong>Total: ${total.toFixed(2)}</strong></p>
          <button onClick={checkout}>Checkout</button>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Orders({ userId }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listOrders(userId).then(setOrders).catch((err) => setError(err.message));
  }, [userId]);

  return (
    <div>
      <h2>Orders</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {orders.length === 0 && <p>No orders yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {orders.map((o) => (
          <li key={o.id} style={{ padding: '8px 0', borderBottom: '1px solid #ddd' }}>
            <div><strong>Order {o.id}</strong> - {o.status} - ${o.total}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{new Date(o.createdAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

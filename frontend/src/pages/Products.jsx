import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Products({ userId }) {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.listProducts().then(setProducts).catch((err) => setError(err.message));
  }, []);

  async function add(productId) {
    if (!userId) {
      setError('Log in first to add items to your cart');
      return;
    }
    try {
      await api.addToCart(userId, productId, 1);
      setMessage('Added to cart');
      setTimeout(() => setMessage(''), 1500);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Products</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {products.map((p) => (
          <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #ddd' }}>
            <span>{p.name} - ${p.price}</span>
            <button onClick={() => add(p.id)}>Add to cart</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api.js';

const ICONS = {
  Keyboard: '⌨️',
  Mouse: '🖱️',
  Monitor: '🖥️',
  Dock: '🔌',
};

function iconFor(name) {
  const match = Object.keys(ICONS).find((key) => name.includes(key));
  return match ? ICONS[match] : '🛍️';
}

export default function Products({ userId }) {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listProducts()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Products</h1>
        <p className="mt-1 text-slate-400">Everything you need, nothing you don&apos;t.</p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 transition-all hover:-translate-y-1 hover:border-indigo-400/40 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-indigo-500/10"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 text-3xl">
                {iconFor(p.name)}
              </div>
              <h3 className="mt-4 font-semibold text-white">{p.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{p.stock} in stock</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-lg font-bold text-white">${p.price.toFixed(2)}</span>
                <button
                  onClick={() => add(p.id)}
                  className="rounded-full bg-indigo-500 px-4 py-1.5 text-sm font-semibold text-white transition-transform hover:scale-105 active:scale-95"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

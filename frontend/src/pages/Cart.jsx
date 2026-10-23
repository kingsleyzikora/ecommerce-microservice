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
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-white">Your cart</h1>

      {error && (
        <p className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {cart.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
          <p className="text-4xl">🛒</p>
          <p className="mt-3 text-slate-400">Your cart is empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="flex flex-col gap-3 lg:col-span-2">
            {cart.items.map((i) => (
              <div
                key={i.productId}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4"
              >
                <div>
                  <p className="font-medium text-white">{i.name}</p>
                  <p className="text-sm text-slate-500">
                    ${i.price.toFixed(2)} × {i.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-white">
                    ${(i.price * i.quantity).toFixed(2)}
                  </span>
                  <button
                    onClick={() => remove(i.productId)}
                    className="text-sm text-slate-500 transition-colors hover:text-rose-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="h-fit rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold text-white">Order summary</h2>
            <div className="mt-4 flex justify-between text-sm text-slate-400">
              <span>Subtotal</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="mt-4 flex justify-between border-t border-white/10 pt-4 text-base font-bold text-white">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <button
              onClick={checkout}
              className="mt-6 w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

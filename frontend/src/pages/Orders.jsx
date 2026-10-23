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
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-white">Your orders</h1>

      {error && (
        <p className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
          <p className="text-4xl">📦</p>
          <p className="mt-3 text-slate-400">No orders yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">Order #{o.id}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {new Date(o.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    {o.status}
                  </span>
                  <p className="mt-1 font-bold text-white">${o.total.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                {o.items.map((i) => (
                  <span
                    key={i.productId}
                    className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400"
                  >
                    {i.name} × {i.quantity}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

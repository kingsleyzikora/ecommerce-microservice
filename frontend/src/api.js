const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `request failed with ${res.status}`);
  }
  return res.json();
}

export const api = {
  register: (data) => request('/api/users/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/api/users/login', { method: 'POST', body: JSON.stringify(data) }),
  listProducts: () => request('/api/products'),
  getCart: (userId) => request(`/api/cart/${userId}`),
  addToCart: (userId, productId, quantity = 1) =>
    request(`/api/cart/${userId}`, { method: 'POST', body: JSON.stringify({ productId, quantity }) }),
  removeFromCart: (userId, productId) => request(`/api/cart/${userId}/${productId}`, { method: 'DELETE' }),
  placeOrder: (userId) => request('/api/orders', { method: 'POST', body: JSON.stringify({ userId }) }),
  listOrders: (userId) => request(`/api/orders/${userId}`),
};

import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Login from './pages/Login.jsx';
import Products from './pages/Products.jsx';
import Cart from './pages/Cart.jsx';
import Orders from './pages/Orders.jsx';

function NavLink({ to, children }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors ${
        active ? 'text-white' : 'text-slate-400 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}

export default function App() {
  const [userId, setUserId] = useState(localStorage.getItem('userId') || '');

  function handleLogin(id) {
    localStorage.setItem('userId', id);
    setUserId(id);
  }

  function handleLogout() {
    localStorage.removeItem('userId');
    setUserId('');
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-base">
              ⚡
            </span>
            shop<span className="text-indigo-400">.</span>
          </Link>

          <nav className="flex items-center gap-6">
            <NavLink to="/">Products</NavLink>
            <NavLink to="/cart">Cart</NavLink>
            <NavLink to="/orders">Orders</NavLink>
          </nav>

          {userId ? (
            <button
              onClick={handleLogout}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:border-white/20 hover:text-white"
            >
              Log out
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-indigo-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105"
            >
              Log in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/" element={<Products userId={userId} />} />
          <Route
            path="/cart"
            element={userId ? <Cart userId={userId} /> : <Navigate to="/login" />}
          />
          <Route
            path="/orders"
            element={userId ? <Orders userId={userId} /> : <Navigate to="/login" />}
          />
        </Routes>
      </main>
    </div>
  );
}

import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Login from './pages/Login.jsx';
import Products from './pages/Products.jsx';
import Cart from './pages/Cart.jsx';
import Orders from './pages/Orders.jsx';

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
    <div style={{ fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto', padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <nav style={{ display: 'flex', gap: 12 }}>
          <Link to="/">Products</Link>
          <Link to="/cart">Cart</Link>
          <Link to="/orders">Orders</Link>
        </nav>
        {userId ? (
          <button onClick={handleLogout}>Log out ({userId})</button>
        ) : (
          <Link to="/login">Log in</Link>
        )}
      </header>

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
    </div>
  );
}

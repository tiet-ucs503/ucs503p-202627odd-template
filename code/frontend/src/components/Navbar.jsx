import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

/**
 * Navbar - Minimal editorial navigation for Travel Sphere.
 * Lightweight, cinematic, and non-intrusive.
 */
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const closeMenu = () => setMobileMenuOpen(false);

  const navLinks = user
    ? [
        { label: 'FEED', path: '/feed' },
        { label: 'EXPLORE', path: '/explore' },
        { label: 'CREATE', path: '/create-post' },
        { label: 'PROFILE', path: `/profile/${user.id}` },
      ]
    : [
        { label: 'EXPLORE', path: '/explore' },
        { label: 'SIGN IN', path: '/login' },
        { label: 'JOIN', path: '/register' },
      ];

  return (
    <motion.header
      className="editorial-nav"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="editorial-nav-container">
        {/* Brand */}
        <Link to="/" className="editorial-brand" onClick={closeMenu}>
          <span className="brand-dot" />
          <span className="brand-name">TRAVEL SPHERE</span>
        </Link>

        {/* Desktop Links */}
        <nav className="editorial-nav-links">
          {navLinks.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`editorial-nav-link ${isActive ? 'is-active' : ''}`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="activeNavIndicator"
                    className="editorial-nav-indicator"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}

          {user && (
            <button
              onClick={handleLogout}
              className="editorial-nav-logout"
              title="Sign out of Travel Sphere"
            >
              <span>LOGOUT</span>
            </button>
          )}
        </nav>

        {/* Mobile Menu Trigger */}
        <button
          className="editorial-menu-toggle"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <span className={`toggle-line ${mobileMenuOpen ? 'open-top' : ''}`} />
          <span className={`toggle-line ${mobileMenuOpen ? 'open-bottom' : ''}`} />
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="editorial-mobile-drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mobile-drawer-inner">
              {navLinks.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`mobile-drawer-link ${pathname === item.path ? 'is-active' : ''}`}
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              ))}
              {user && (
                <button onClick={handleLogout} className="mobile-drawer-logout">
                  LOGOUT
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

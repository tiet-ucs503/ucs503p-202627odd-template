import React from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * HomePage - Protected landing page (placeholder for future chunks).
 *
 * Displays the logged-in user's name and a Logout button.
 * Will be replaced/extended with feed and destination content in later chunks.
 */
export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="home-page">
      <header className="home-header">
        <h1>🌍 TravelSphere</h1>
        <button className="auth-btn logout-btn" onClick={logout}>
          Log out
        </button>
      </header>
      <main className="home-main">
        <h2>Welcome, {user?.full_name || user?.username}!</h2>
        <p className="home-sub">Your travel feed and destinations will appear here.</p>
      </main>
    </div>
  );
}
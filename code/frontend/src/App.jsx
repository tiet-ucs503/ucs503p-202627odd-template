import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute       from './components/ProtectedRoute';
import LoginPage            from './pages/LoginPage';
import RegisterPage         from './pages/RegisterPage';
import FeedPage             from './pages/FeedPage';
import ExplorePage          from './pages/ExplorePage';
import CreatePostPage       from './pages/CreatePostPage';
import PostDetailPage       from './pages/PostDetailPage';
import ProfilePage          from './pages/ProfilePage';
import DestinationDetailPage from './pages/DestinationDetailPage';
import IntroCanvas from './components/intro/IntroCanvas';

function IntroHome() {
  const navigate = useNavigate();

  return (
    <IntroCanvas
      onExplore={() => navigate('/explore')}
      onLogin={() => navigate('/login')}
      onCreateAccount={() => navigate('/register')}
    />
  );
}

/**
 * App.jsx - Root component with full MVP routing.
 *
 * Public routes (no auth required by API):
 *   /               → IntroCanvas   (intro and landing screen)
 *   /login           → LoginPage
 *   /register        → RegisterPage
 *   /explore         → ExplorePage
 *   /post/:postId    → PostDetailPage
 *   /profile/:userId → ProfilePage
 *   /destination/:destinationId → DestinationDetailPage
 *
 * Protected routes (Bearer token required):
 *   /feed           → FeedPage      (GET /feed requires auth)
 *   /create-post    → CreatePostPage
 *
 * AuthProvider wraps the entire tree — every component can call useAuth().
 * BrowserRouter is provided by main.jsx.
 */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Public ── */}
        <Route path="/"         element={<IntroHome />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Public discovery — no token needed to view */}
        <Route path="/explore"                      element={<ExplorePage />} />
        <Route path="/post/:postId"                 element={<PostDetailPage />} />
        <Route path="/profile/:userId"              element={<ProfilePage />} />
        <Route path="/destination/:destinationId"   element={<DestinationDetailPage />} />

        {/* ── Protected ── */}
        <Route element={<ProtectedRoute />}>
          <Route path="/feed"        element={<FeedPage />} />
          <Route path="/create-post" element={<CreatePostPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

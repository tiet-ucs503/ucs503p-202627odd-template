
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import HomePage from '@/pages/HomePage';
import AuthPage from '@/pages/AuthPage';
import DashboardPage from '@/pages/DashboardPage';
import CheckPostingPage from '@/pages/CheckPostingPage';
import HistoryPage from '@/pages/HistoryPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import SettingsPage from '@/pages/SettingsPage';
import HelpPage from '@/pages/HelpPage';

// Protect pages that require login
function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem('authToken');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route
        path="/login"
        element={<AuthPage initialMode="login" />}
      />

      <Route
        path="/signup"
        element={<AuthPage initialMode="signup" />}
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/check"
        element={
          <ProtectedRoute>
            <CheckPostingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <HelpPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

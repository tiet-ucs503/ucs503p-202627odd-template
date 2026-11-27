import React, { Suspense, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
const DashboardLayout = React.lazy(() => import('./components/DashboardLayout').then((module) => ({ default: module.DashboardLayout })));
const TimetableProvider = React.lazy(() => import('./context/TimetableContext').then((module) => ({ default: module.TimetableProvider })));
import { LoginPageView } from './components/views/LoginPageView';
import { VerifyEmailView } from './components/views/VerifyEmailView';
import { WorkspaceSelectionView } from './components/views/WorkspaceSelectionView';
import { WorkspaceType } from './types';

function MainLayout() {
  const { authStatus, authorizedWorkspaces, switchWorkspace, logout } = useAuth();
  const [showLoginPage, setShowLoginPage] = useState(true);
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(() => window.location.pathname === '/verify-email');

  useEffect(() => {
    if (authStatus === 'AUTHENTICATED') {
      setShowLoginPage(false);
    }
  }, [authStatus]);

  const handleLoginSuccess = (incomingWorkspaces?: WorkspaceType[]) => {
    setShowLoginPage(false);
    const ws = incomingWorkspaces || authorizedWorkspaces;
    if (ws && ws.length > 1) {
      setShowWorkspacePicker(true);
    } else {
      setShowWorkspacePicker(false);
    }
  };

  const handleSelectWorkspace = (ws: WorkspaceType) => {
    switchWorkspace(ws);
    setShowWorkspacePicker(false);
  };

  const handleSignOut = async () => {
    const revocation = logout();
    setShowWorkspacePicker(false);
    setShowLoginPage(true);
    window.history.replaceState(null, '', '/');
    await revocation;
  };

  const returnToLogin = () => {
    window.history.replaceState(null, '', '/');
    setShowEmailVerification(false);
    setShowLoginPage(true);
  };

  if (showEmailVerification) {
    return <VerifyEmailView onBackToLogin={returnToLogin} />;
  }

  if (showLoginPage) {
    return (
      <LoginPageView
        onSuccessLogin={handleLoginSuccess}
      />
    );
  }

  if (showWorkspacePicker && authorizedWorkspaces.length > 1) {
    return (
      <WorkspaceSelectionView
        workspaces={authorizedWorkspaces}
        onSelectWorkspace={handleSelectWorkspace}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <Suspense fallback={<div role="status" className="flex min-h-screen items-center justify-center text-sm text-stone-500">Loading your workspace…</div>}>
      <TimetableProvider>
        <DashboardLayout
          onSignOutToLogin={handleSignOut}
          onOpenWorkspacePicker={() => setShowWorkspacePicker(true)}
        />
      </TimetableProvider>
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}

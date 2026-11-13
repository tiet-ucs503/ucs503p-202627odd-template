import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Missions from '@/components/Missions';
import HowItWorks from '@/components/HowItWorks';
import BossBattles from '@/components/BossBattles';
import Gamification from '@/components/Gamification';
import Footer from '@/components/Footer';
import Dashboard from '@/components/Dashboard';
import ParentDashboard from '@/components/ParentDashboard';
import MissionPlayer from '@/components/MissionPlayer';
import AuthModal from '@/components/AuthModal';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { GameProvider } from '@/context/GameContext';
import type { Role } from '@/lib/api';

const needsLogin = (view: string) =>
  view.startsWith('mission') || view === 'dashboard' || view === 'parent-dashboard';

function AppContent() {
  const [currentView, setCurrentView] = useState<string>('landing');
  const { user, isAuthenticated, loading, isAuthModalOpen, closeAuthModal, openAuthModal } = useAuth();
  const isGuardian = user?.role === 'parent' || user?.role === 'teacher';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView]);

  // Which screens are shown is a convenience only. What each account may
  // actually read or do is enforced by the server on every request.
  const handleSetView = (view: string) => {
    if (needsLogin(view) && !isAuthenticated) {
      openAuthModal();
      return;
    }
    setCurrentView(view);
  };

  useEffect(() => {
    if (!loading && needsLogin(currentView) && !isAuthenticated) {
      setCurrentView('landing');
    }
  }, [currentView, isAuthenticated, loading]);

  const handleAuthSuccess = (role: Role) => {
    setCurrentView(role === 'student' ? 'dashboard' : 'parent-dashboard');
  };

  const inMission = currentView.startsWith('mission') && !isGuardian;

  return (
    <div className="min-h-screen spider-bg text-white relative">
      <div className="fixed inset-0 spider-halftone pointer-events-none z-0 opacity-70" />
      <div className="relative z-10 flex flex-col min-h-screen">
        {!inMission && <Navbar setView={handleSetView} />}

        {user?.is_demo && (
          <div
            role="status"
            className="fixed bottom-0 inset-x-0 z-[60] bg-yellow-400 text-black text-center text-xs sm:text-sm font-bold py-1.5 px-3"
          >
            Demo account. Everything shown here is sample data, not a real student.
          </div>
        )}

        <main className="flex-1">
          {isGuardian ? (
            <ParentDashboard />
          ) : (
            <>
              {currentView === 'landing' && (
                <>
                  <Hero setView={handleSetView} />
                  <Missions setView={handleSetView} />
                  <HowItWorks />
                  <BossBattles setView={handleSetView} />
                  <Gamification setView={handleSetView} />
                </>
              )}
              {currentView === 'dashboard' && <Dashboard setView={handleSetView} />}
              {inMission && isAuthenticated && (
                <MissionPlayer
                  key={currentView}
                  bossId={currentView.split(':')[1] || 'goblin'}
                  onExit={() => setCurrentView('dashboard')}
                  onNextLevel={(nextBoss) => setCurrentView('mission:' + nextBoss)}
                />
              )}
            </>
          )}
        </main>

        {!inMission && <Footer />}

        <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} onSuccess={handleAuthSuccess} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <AppContent />
      </GameProvider>
    </AuthProvider>
  );
}

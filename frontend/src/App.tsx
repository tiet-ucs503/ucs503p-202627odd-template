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

function AppContent() {
  const [currentView, setCurrentView] = useState<string>('landing');
  const { user, isAuthenticated, isAuthModalOpen, closeAuthModal, openAuthModal } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView]);

  // Enforce authentication & role separation:
  // Parents/Teachers ONLY see ParentDashboard, never the student gaming arenas
  useEffect(() => {
    if (user && (user.role === 'parent' || user.role === 'teacher')) {
      if (currentView !== 'parent-dashboard') {
        setCurrentView('parent-dashboard');
      }
    }
  }, [user?.role, currentView]);

  const handleSetView = (view: string) => {
    if (user && (user.role === 'parent' || user.role === 'teacher')) {
      setCurrentView('parent-dashboard');
      return;
    }
    if ((view.startsWith('mission') || view === 'dashboard' || view === 'parent-dashboard') && !isAuthenticated) {
      openAuthModal();
      return;
    }
    setCurrentView(view);
  };

  useEffect(() => {
    if ((currentView.startsWith('mission') || currentView === 'dashboard' || currentView === 'parent-dashboard') && !isAuthenticated) {
      setCurrentView('landing');
      openAuthModal();
    }
  }, [currentView, isAuthenticated]);

  const handleAuthSuccess = (role: 'student' | 'parent' | 'teacher') => {
    if (role === 'parent' || role === 'teacher') {
      setCurrentView('parent-dashboard');
    } else {
      setCurrentView('dashboard');
    }
  };

  return (
    <div className="min-h-screen spider-bg text-white relative">
      <div className="fixed inset-0 spider-halftone pointer-events-none z-0 opacity-70" />
      <div className="relative z-10 flex flex-col min-h-screen">
        {!currentView.startsWith('mission') && <Navbar setView={handleSetView} />}
        
        <main className="flex-1">
          {user && (user.role === 'parent' || user.role === 'teacher') ? (
            <ParentDashboard setView={handleSetView} />
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
              {currentView === 'parent-dashboard' && <ParentDashboard setView={handleSetView} />}
              {currentView.startsWith('mission') && isAuthenticated && (
                <MissionPlayer 
                  bossId={currentView.split(':')[1] || 'goblin'} 
                  onExit={() => setCurrentView('dashboard')} 
                  onNextLevel={(nextBoss) => setCurrentView('mission:' + nextBoss)} 
                />
              )}
            </>
          )}
        </main>

        {!currentView.startsWith('mission') && <Footer />}

        {/* Auth Modal for Student, Parent, and Teacher Login / Registration */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          onSuccess={handleAuthSuccess}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

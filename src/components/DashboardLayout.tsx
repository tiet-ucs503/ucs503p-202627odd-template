import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { useTimetable } from '../context/TimetableContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getUserInitials } from '../lib/userUtils';
import { Sidebar } from './Sidebar';
import { AcademicInboxModal } from './modals/AcademicInboxModal';
import { UserProfileModal } from './modals/UserProfileModal';

// Keep portal and spreadsheet-import code out of the sign-in/initial page bundle.
const CoordinatorView = lazy(() => import('./views/CoordinatorView').then((m) => ({ default: m.CoordinatorView })));
const TimetableGridView = lazy(() => import('./views/TimetableGridView').then((m) => ({ default: m.TimetableGridView })));
const RecoveryEngineView = lazy(() => import('./views/RecoveryEngineView').then((m) => ({ default: m.RecoveryEngineView })));
const FacultyPortalView = lazy(() => import('./views/FacultyPortalView').then((m) => ({ default: m.FacultyPortalView })));
const FacultyAvailabilityView = lazy(() => import('./views/FacultyAvailabilityView').then((m) => ({ default: m.FacultyAvailabilityView })));
const StudentPortalView = lazy(() => import('./views/StudentPortalView').then((m) => ({ default: m.StudentPortalView })));
const CRPortalView = lazy(() => import('./views/CRPortalView').then((m) => ({ default: m.CRPortalView })));
const AdminPortalView = lazy(() => import('./views/AdminPortalView').then((m) => ({ default: m.AdminPortalView })));
const GovernanceView = lazy(() => import('./views/GovernanceView').then((m) => ({ default: m.GovernanceView })));
const AcademicSetupHubView = lazy(() => import('./views/AcademicSetupHubView').then((m) => ({ default: m.AcademicSetupHubView })));
const GenerateTimetablePage = lazy(() => import('./views/GenerateTimetablePage').then((m) => ({ default: m.GenerateTimetablePage })));
const SettingsView = lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })));
const WhatIfSimulatorView = lazy(() => import('./views/WhatIfSimulatorView').then((m) => ({ default: m.WhatIfSimulatorView })));
const WorkloadSyllabusView = lazy(() => import('./views/WorkloadSyllabusView').then((m) => ({ default: m.WorkloadSyllabusView })));
const RequestsView = lazy(() => import('./views/RequestsView').then((m) => ({ default: m.RequestsView })));
const HodPortalView = lazy(() => import('./views/HodPortalView').then((m) => ({ default: m.HodPortalView })));

import {
  Menu,
  Bell,
  User,
  LogOut,
  ChevronDown,
  ArrowRightLeft,
  Check,
  Sun,
  Moon,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

interface DashboardLayoutProps {
  onSignOutToLogin: () => void;
  onOpenWorkspacePicker?: () => void;
}

export function DashboardLayout({
  onSignOutToLogin,
}: DashboardLayoutProps) {
  const {
    activeView,
    setActiveView,
    setCurrentRole,
    notifications,
    isLoading,
    loadError,
    refresh,
    notice,
    dismissNotice,
    resetDemoAcademicData,
  } = useTimetable();

  const {
    currentUser,
    currentWorkspace,
    authorizedWorkspaces,
    switchWorkspace,
  } = useAuth();

  const { theme, toggleTheme } = useTheme();

  // Navigation & Modals state
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [openTopbarMenu, setOpenTopbarMenu] = useState<'presentation' | 'workspace' | null>(null);
  const topbarMenusRef = useRef<HTMLDivElement>(null);
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [resetToast, setResetToast] = useState<{ success: boolean; message: string } | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Auto-sync activeView when currentWorkspace changes
  useEffect(() => {
    const pathWorkspace = window.location.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
    const workspacePath = currentWorkspace === 'CR' ? 'cr' : currentWorkspace.toLowerCase();
    const pathMatchesWorkspace = pathWorkspace === workspacePath;
    if (pathMatchesWorkspace) {
      switch (currentWorkspace) {
        case 'Student': case 'CR': setCurrentRole('Student'); break;
        case 'Faculty': setCurrentRole('Faculty'); break;
        case 'HOD': setCurrentRole('HOD'); break;
        case 'Coordinator': setCurrentRole('Coordinator'); break;
        case 'Admin': setCurrentRole('Admin'); break;
      }
      return;
    }
    switch (currentWorkspace) {
      case 'Student':
        setActiveView('student_portal');
        setCurrentRole('Student');
        break;
      case 'CR':
        setActiveView('student_portal');
        setCurrentRole('Student');
        break;
      case 'Faculty':
        setActiveView('faculty_portal');
        setCurrentRole('Faculty');
        break;
      case 'HOD':
        setActiveView('overview');
        setCurrentRole('HOD');
        break;
      case 'Coordinator':
        setActiveView('overview');
        setCurrentRole('Coordinator');
        break;
      case 'Admin':
        setActiveView('overview');
        setCurrentRole('Admin');
        break;
    }
  }, [currentWorkspace, setActiveView]);

  // Toasts disappear on their own after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => dismissNotice?.(), notice.type === 'error' ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [notice, dismissNotice]);

  // Keep the top-bar menus mutually exclusive and dismiss them on outside clicks.
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !topbarMenusRef.current?.contains(event.target)) {
        setOpenTopbarMenu(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false);
        setOpenTopbarMenu(null);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const syncPathname = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', syncPathname);
    window.addEventListener('hashchange', syncPathname);
    return () => {
      window.removeEventListener('popstate', syncPathname);
      window.removeEventListener('hashchange', syncPathname);
    };
  }, []);

  // activeView is the in-portal route state; pathname catches direct/browser routes.
  useEffect(() => setOpenTopbarMenu(null), [activeView, currentWorkspace, pathname]);

  const handleSignOut = () => {
    onSignOutToLogin();
  };

  const getWorkspaceTitle = () => {
    switch (currentWorkspace) {
      case 'Student': return 'Student Portal';
      case 'CR': return 'Student Portal';
      case 'Faculty': return 'Faculty Portal';
      case 'Coordinator': return 'HOD Portal';
      case 'Admin': return 'Admin Console';
      case 'HOD': return 'HOD Portal';
    }
  };

  return (
    <div className="study-workspace min-h-screen bg-[#F7F6F2] dark:bg-[#0c0c0e] text-stone-900 dark:text-zinc-100 flex flex-col font-sans antialiased">
      {/* 1. Compact Enterprise Header */}
      <header className="study-topbar h-12 bg-[#FAF9F5] dark:bg-zinc-900 border-b border-[#E5E2D9] dark:border-zinc-800 px-3 sm:px-5 flex items-center justify-between sticky top-0 z-30">
        {/* Left: Mobile Drawer Trigger + Portal Context */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden p-1.5 text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white rounded transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>

          <span className="text-xs text-stone-600 dark:text-zinc-400 font-semibold">{getWorkspaceTitle()}</span>
          {(currentWorkspace === 'HOD' || currentWorkspace === 'Coordinator') && (
            <div className="ml-2 inline-flex items-center rounded-lg border border-[#E5E2D9] dark:border-zinc-700 bg-white dark:bg-zinc-950 p-0.5 shadow-2xs" role="tablist" aria-label="HOD Workspace Sections">
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'generation_validator' || activeView === 'academic_setup' || activeView === 'whatif'}
                onClick={() => setActiveView('generation_validator')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  activeView === 'generation_validator' || activeView === 'academic_setup' || activeView === 'whatif'
                    ? 'bg-[#8C1B2E] text-white shadow-2xs'
                    : 'text-stone-600 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                Timetable Generator
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'overview' || activeView === 'syllabus' || activeView === 'recovery' || activeView === 'grid'}
                onClick={() => setActiveView('overview')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  activeView === 'overview' || activeView === 'syllabus' || activeView === 'recovery' || activeView === 'grid'
                    ? 'bg-[#8C1B2E] text-white shadow-2xs'
                    : 'text-stone-600 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                HOD Portal
              </button>
            </div>
          )}
        </div>

        {/* Right: Multi-Role Switcher + Theme Toggle + Notifications + User Profile */}
        <div className="flex items-center gap-2">
          <div ref={topbarMenusRef} className="flex items-center gap-2">
          {currentUser?.isDemoUser && (
            <div className="relative">
              <button type="button" aria-haspopup="menu" aria-expanded={openTopbarMenu === 'presentation'} onClick={() => setOpenTopbarMenu(openTopbarMenu === 'presentation' ? null : 'presentation')} className="inline-flex items-center gap-1 rounded-md border border-[#E5E2D9] bg-white px-2 py-1 text-[10px] font-semibold text-stone-600 hover:text-[#8C1B2E] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Presentation controls <ChevronDown className="h-3 w-3" /></button>
              {openTopbarMenu === 'presentation' && (
              <div className="absolute right-0 mt-1 z-40 rounded-lg border border-[#E5E2D9] bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <button
              type="button"
              disabled={resettingDemo}
              onClick={async () => {
                if (!window.confirm('Restore the shared demo timetable and academic data to its seeded state?')) return;
                setResettingDemo(true);
                try {
                  const result = await resetDemoAcademicData();
                  setResetToast({ success: result.success, message: result.message || (result.success ? 'Demo data reset.' : 'Demo data could not be reset.') });
                } catch (error) {
                  setResetToast({ success: false, message: error instanceof Error ? error.message : 'Demo data could not be reset.' });
                } finally {
                  setResettingDemo(false);
                }
              }}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-50 hover:text-[#8C1B2E] disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="Restore the shared demo dataset"
            >
              <RotateCcw className={`h-3 w-3 ${resettingDemo ? 'animate-spin' : ''}`} />{resettingDemo ? 'Resetting…' : 'Reset Demo'}
            </button>
              </div>
              )}
            </div>
          )}
          {/* Quick Workspace Switcher */}
          {authorizedWorkspaces.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setOpenTopbarMenu(openTopbarMenu === 'workspace' ? null : 'workspace')}
                aria-haspopup="menu"
                aria-expanded={openTopbarMenu === 'workspace'}
                aria-label="Switch workspace"
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800 border border-[#E5E2D9] dark:border-zinc-700 text-[11px] font-medium text-stone-700 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white transition-colors shadow-2xs"
              >
                <ArrowRightLeft className="h-3 w-3 text-[#8C1B2E] dark:text-red-400" />
                <span>{currentWorkspace === 'CR' ? 'Class Rep' : currentWorkspace === 'Coordinator' ? 'HOD' : currentWorkspace}</span>
                <ChevronDown className="h-3 w-3 text-stone-400" />
              </button>

              {openTopbarMenu === 'workspace' && (
                <div className="absolute right-0 mt-1 w-44 bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg shadow-lg p-1 z-40 space-y-0.5">
                  <div className="px-2 py-0.5 text-[10px] font-mono text-stone-400 dark:text-zinc-500 uppercase tracking-wider">
                    Switch Workspace
                  </div>
                  {authorizedWorkspaces.filter((ws) => !(ws === 'Coordinator' && authorizedWorkspaces.includes('HOD'))).map(ws => {
                    const isActive = currentWorkspace === ws || (ws === 'HOD' && currentWorkspace === 'Coordinator');
                    return (
                    <button
                      key={ws}
                      onClick={() => {
                        switchWorkspace(ws === 'Coordinator' ? 'HOD' : ws);
                        setOpenTopbarMenu(null);
                      }}
                      className={`w-full text-left px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center justify-between ${
                        isActive
                          ? 'bg-[#8C1B2E] text-white font-semibold'
                          : 'text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span>{ws === 'CR' ? 'Class Representative' : ws === 'Coordinator' ? 'HOD Portal' : `${ws} Portal`}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            title="Toggle Light / Dark Theme"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-stone-600" />}
          </button>

          {/* Notifications Button */}
          <button
            onClick={() => { setOpenTopbarMenu(null); setInboxOpen(true); }}
            aria-label={`Open notifications (${unreadCount} unread)`}
            className="relative p-1.5 rounded-md text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            title="Notifications & Alerts"
          >
            <Bell className="h-3.5 w-3.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#8C1B2E] ring-2 ring-white dark:ring-zinc-900" />
            )}
          </button>

          {/* User Profile & Sign Out */}
          <div className="flex items-center gap-1 pl-2 border-l border-[#E5E2D9] dark:border-zinc-800">
            <button
              onClick={() => { setOpenTopbarMenu(null); setProfileModalOpen(true); }}
              aria-label="Open your profile"
              className="flex items-center gap-1.5 p-1 rounded-md hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors text-left"
            >
              <div className="w-5 h-5 rounded-full bg-[#8C1B2E]/10 text-[#8C1B2E] border border-[#8C1B2E]/30 flex items-center justify-center font-bold text-[10px] shrink-0">
                {getUserInitials(currentUser?.name)}
              </div>
              <span className="hidden sm:inline text-xs font-semibold text-stone-700 dark:text-zinc-300 max-w-[200px] lg:max-w-[260px] truncate">
                {currentUser?.name || 'User'}
              </span>
            </button>

            <button
              onClick={handleSignOut}
              className="p-1 text-stone-400 hover:text-[#8C1B2E] dark:text-zinc-400 dark:hover:text-red-400 transition-colors"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Body: Sidebar + Main Workspace Content */}
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          onOpenProfile={() => setProfileModalOpen(true)}
          onOpenNotifications={() => setInboxOpen(true)}
          onShowLoginPage={onSignOutToLogin}
        />

        {/* Main Workspace */}
        <main className="study-content flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F7F6F2] dark:bg-[#0c0c0e]">
          {loadError && (
            <div role="alert" className="mb-4 p-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
              <span>Could not load the latest timetable data: {loadError}</span>
              <button onClick={() => refresh?.()} className="px-3 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-800 font-semibold">Retry</button>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-stone-500 text-xs gap-2" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-[#8C1B2E]" aria-hidden="true" />
              <span>Loading timetable data…</span>
            </div>
          ) : (
          <Suspense fallback={<div role="status" className="flex justify-center py-16 text-xs text-stone-500">Loading workspace…</div>}>
          <>
          {currentWorkspace === 'Student' && <StudentPortalView />}
          {currentWorkspace === 'CR' && <CRPortalView />}
          {currentWorkspace === 'Faculty' && (activeView === 'grid' ? <TimetableGridView /> : activeView === 'availability' ? <FacultyAvailabilityView /> : <FacultyPortalView />)}
          {currentWorkspace === 'Admin' && <AdminPortalView />}
          {(currentWorkspace === 'HOD' || currentWorkspace === 'Coordinator') && (
            <>
              {activeView === 'overview' && <HodPortalView />}
              {activeView === 'coordinator_hub' && <CoordinatorView />}
              {activeView === 'grid' && <TimetableGridView />}
              {activeView === 'academic_setup' && <AcademicSetupHubView />}
              {activeView === 'master_excel' && <AcademicSetupHubView />}
              {activeView === 'academic_year' && <AcademicSetupHubView />}
              {activeView === 'departments' && <AcademicSetupHubView />}
              {activeView === 'programs' && <AcademicSetupHubView />}
              {activeView === 'courses_mgmt' && <AcademicSetupHubView />}
              {activeView === 'faculty_mgmt' && <AcademicSetupHubView />}
              {activeView === 'rooms_mgmt' && <AcademicSetupHubView />}
              {activeView === 'sections_mgmt' && <AcademicSetupHubView />}
              {activeView === 'students' && <AcademicSetupHubView />}
              {activeView === 'allocations' && <AcademicSetupHubView />}
              {activeView === 'availability' && <AcademicSetupHubView />}
              {activeView === 'constraints' && <AcademicSetupHubView />}
              {activeView === 'timetable_review' && <AcademicSetupHubView />}
              {activeView === 'generation_validator' && <GenerateTimetablePage />}
              {activeView === 'recovery' && <RequestsView />}
              {activeView === 'whatif' && <WhatIfSimulatorView />}
              {activeView === 'syllabus' && <WorkloadSyllabusView />}
              {activeView === 'settings' && <SettingsView />}
              {activeView === 'governance' && <GovernanceView />}
            </>
          )}
          </>
          </Suspense>
          )}

          <footer className="mt-8 pt-4 border-t border-[#E5E2D9] dark:border-zinc-800/80 text-center text-[11px] text-stone-500 dark:text-zinc-500">
            Thapar Institute of Engineering & Technology · Academic Timetable & Class Operations System
          </footer>
        </main>
      </div>

      {notice && (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[70] p-3 rounded-xl border shadow-lg text-xs flex items-start gap-2 ${notice.type === 'error' ? 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200' : 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'}`}
        >
          {notice.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />}
          <span className="flex-1 whitespace-pre-line leading-relaxed">{notice.message}</span>
          <button onClick={dismissNotice} aria-label="Dismiss message" className="p-0.5 rounded hover:bg-black/5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {resetToast && (
        <div role={resetToast.success ? 'status' : 'alert'} className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[71] rounded-xl border p-3 text-xs shadow-lg ${resetToast.success ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'}`}>
          {resetToast.message}
          <button type="button" onClick={() => setResetToast(null)} className="ml-3 font-semibold underline">Dismiss</button>
        </div>
      )}

      {/* Global Modals */}
      {inboxOpen && <AcademicInboxModal isOpen={inboxOpen} onClose={() => setInboxOpen(false)} />}
      {profileModalOpen && (
        <UserProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
        />
      )}
    </div>
  );
}

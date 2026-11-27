import React, { useState, useEffect } from 'react';
import { ThaparLogo } from './ThaparLogo';
import { useTimetable, ViewTab } from '../context/TimetableContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ChevronDown,
  ChevronRight,
  X,
  User,
  Sun,
  Moon,
  Calendar,
  BookOpen,
  Users,
  Clock,
  Bell,
  Settings,
  Shield,
  Layers,
  Sparkles,
  Sliders,
  Activity,
  ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  onOpenProfile?: () => void;
  onOpenNotifications?: () => void;
  onShowLoginPage?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  onOpenProfile,
  onOpenNotifications,
  isOpen = false,
  onClose,
}: SidebarProps = {}) {
  const { activeView, setActiveView } = useTimetable();
  const { currentWorkspace } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isSetupActive = ['academic_year', 'departments', 'courses_mgmt', 'faculty_mgmt', 'rooms_mgmt', 'sections_mgmt', 'academic_setup'].includes(activeView);
  const isTimetableActive = ['allocations', 'availability', 'generation_validator', 'grid'].includes(activeView);
  const isReviewActive = ['governance', 'recovery'].includes(activeView);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    setup: isSetupActive,
    timetable: isTimetableActive,
    review: isReviewActive,
  });

  useEffect(() => {
    setExpandedGroups(prev => ({
      ...prev,
      setup: isSetupActive || prev.setup,
      timetable: isTimetableActive || prev.timetable,
      review: isReviewActive || prev.review,
    }));
  }, [activeView]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelect = (view: ViewTab) => {
    setActiveView(view);
    if (onClose) onClose();
  };

  const isStudent = currentWorkspace === 'Student' || currentWorkspace === 'CR';
  const isFaculty = currentWorkspace === 'Faculty';
  const isHod = currentWorkspace === 'HOD';
  const isCoordinator = currentWorkspace === 'Coordinator';
  const isAdmin = currentWorkspace === 'Admin';

  const navContent = (
    <div className="study-sidebar flex flex-col h-full bg-[#FAF9F5] dark:bg-zinc-900 border-r border-[#E5E2D9] dark:border-zinc-800 text-stone-700 dark:text-zinc-300 w-60 select-none text-xs font-medium">
      {/* Brand Header */}
      <div className="p-3.5 border-b border-[#E5E2D9] dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ThaparLogo size="sm" variant="mark-only" />
          <div>
            <h2 className="text-xs font-bold text-stone-900 dark:text-zinc-100 leading-none">
              Thapar Timetable
            </h2>
            <p className="text-[10px] text-stone-500 dark:text-zinc-400 mt-0.5 font-medium">
              {isStudent ? 'Student Portal' : isFaculty ? 'Faculty Portal' : isHod ? 'HOD Portal' : isAdmin ? 'Admin Console' : 'HOD & Scheduling Portal'}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation Items (Role-Specific Architecture) */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2">
        {/* STUDENT NAVIGATION */}
        {isStudent && (
          <div className="space-y-1">
            <button
              onClick={() => handleSelect('overview')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${
                activeView === 'overview' || activeView === 'student_portal'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleSelect('grid')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${
                activeView === 'grid'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>My Timetable</span>
            </button>

            <button
              onClick={() => handleSelect('student_courses')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${
                activeView === 'student_courses'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span>My Courses</span>
            </button>

            <button
              onClick={() => handleSelect('student_section')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${
                activeView === 'student_section'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>My Section</span>
            </button>

            <button
              onClick={() => {
                if (onOpenNotifications) onOpenNotifications();
                if (onClose) onClose();
              }}
              className="w-full text-left px-3 py-2 rounded-lg transition-all font-medium text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center gap-2"
            >
              <Bell className="h-4 w-4 shrink-0 text-stone-500" />
              <span>Notifications</span>
            </button>

            <button
              onClick={() => {
                if (onOpenProfile) onOpenProfile();
                if (onClose) onClose();
              }}
              className="w-full text-left px-3 py-2 rounded-lg transition-all font-medium text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center gap-2"
            >
              <User className="h-4 w-4 shrink-0 text-stone-500" />
              <span>Profile</span>
            </button>
          </div>
        )}

        {/* FACULTY NAVIGATION */}
        {isFaculty && (
          <div className="space-y-1">
            <button
              onClick={() => handleSelect('overview')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${
                activeView === 'overview' || activeView === 'faculty_portal'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleSelect('grid')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${
                activeView === 'grid'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>My Timetable</span>
            </button>
          </div>
        )}

        {isHod && (
          <div className="space-y-1">
            {([
              ['overview', 'Department Overview', Users],
              ['grid', 'Timetable', Clock],
              ['syllabus', 'Syllabus Progress', BookOpen],
              ['recovery', 'Requests & Disruptions', Bell],
            ] as const).map(([view, label, Icon]) => (
              <button key={view} onClick={() => handleSelect(view)} className={`w-full text-left px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${activeView === view ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs' : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* COORDINATOR NAVIGATION (EXACTLY 5 PRIMARY ITEMS) */}
        {isCoordinator && (
          <div className="space-y-1 font-medium">
            {/* 1. HOME */}
            <button
              onClick={() => handleSelect('overview')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2.5 ${
                activeView === 'overview'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Home</span>
            </button>

            {/* 2. TIMETABLE */}
            <button
              onClick={() => handleSelect('grid')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2.5 ${
                activeView === 'grid'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>Timetable</span>
            </button>

            {/* 3. DATA */}
            <button
              onClick={() => handleSelect('academic_setup')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2.5 ${
                ['academic_setup', 'master_excel', 'academic_year', 'departments', 'programs', 'courses_mgmt', 'faculty_mgmt', 'rooms_mgmt', 'sections_mgmt', 'students', 'allocations', 'availability', 'constraints', 'generation_validator', 'timetable_review'].includes(activeView)
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span>Data</span>
            </button>

            {/* 4. REQUESTS */}
            <button
              onClick={() => handleSelect('recovery')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2.5 ${
                activeView === 'recovery'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <Bell className="h-4 w-4 shrink-0" />
              <span>Requests</span>
            </button>

            {/* 5. SETTINGS */}
            <button
              onClick={() => handleSelect('settings')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2.5 ${
                activeView === 'settings'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span>Settings</span>
            </button>

            {/* SECONDARY MORE MENU FOR ADVANCED TOOLS */}
            <div className="pt-2 border-t border-[#E5E2D9] dark:border-zinc-800/60 mt-2">
              <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-stone-400 dark:text-zinc-500 font-semibold">
                Advanced Tools
              </div>
              <button
                onClick={() => handleSelect('whatif')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-2 ${
                  activeView === 'whatif'
                    ? 'bg-stone-200 dark:bg-zinc-700 text-stone-900 dark:text-white font-semibold'
                    : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-400'
                }`}
              >
                <Sliders className="h-3.5 w-3.5 shrink-0 text-stone-500" />
                <span>What-If Simulator</span>
              </button>

              <button
                onClick={() => handleSelect('syllabus')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-2 ${
                  activeView === 'syllabus'
                    ? 'bg-stone-200 dark:bg-zinc-700 text-stone-900 dark:text-white font-semibold'
                    : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-400'
                }`}
              >
                <Activity className="h-3.5 w-3.5 shrink-0 text-stone-500" />
                <span>Syllabus Progress</span>
              </button>

              <button
                onClick={() => handleSelect('governance')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-2 ${
                  activeView === 'governance'
                    ? 'bg-stone-200 dark:bg-zinc-700 text-stone-900 dark:text-white font-semibold'
                    : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-400'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-stone-500" />
                <span>Audit & Governance</span>
              </button>
            </div>
          </div>
        )}

        {/* ADMIN NAVIGATION */}
        {isAdmin && (
          <div className="space-y-1">
            <button
              onClick={() => handleSelect('overview')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${
                activeView === 'overview'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span>Admin Console</span>
            </button>

            <button
              onClick={() => handleSelect('governance')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${
                activeView === 'governance'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <Layers className="h-4 w-4 shrink-0" />
              <span>Master Approvals</span>
            </button>

            <button
              onClick={() => handleSelect('auth_gov')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${
                activeView === 'auth_gov'
                  ? 'bg-[#8C1B2E] text-white font-semibold shadow-xs'
                  : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
              }`}
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span>Users & Roles</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer Settings */}
      <div className="p-2.5 border-t border-[#E5E2D9] dark:border-zinc-800 bg-[#F4F2EC] dark:bg-zinc-950/60">
        <div className="flex items-center justify-between px-2 py-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 text-[11px] text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100 transition-colors font-medium"
            title="Toggle Light / Dark Theme"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-stone-600" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:block h-screen sticky top-0 shrink-0">
        {navContent}
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full w-[80%] max-w-[280px]">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}

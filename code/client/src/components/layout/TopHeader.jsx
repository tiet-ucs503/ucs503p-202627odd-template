import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Menu, Target, Search } from 'lucide-react';
import ThemeSwitcher from '../common/ThemeSwitcher';
import { useAuth } from '../../context/AuthContext';
import { getUserInitials } from '../../utils/userDisplay';

export default function TopHeader({ onMobileMenuToggle, dueCount = 0 }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const getBreadcrumb = () => {
    if (location.pathname === '/') return 'Command Center';
    if (location.pathname.startsWith('/problems/')) return 'Problem Details & Analysis';
    if (location.pathname === '/problems') return 'Problem Library';
    if (location.pathname === '/patterns') return 'Pattern Mastery';
    return 'CPRecal';
  };

  return (
    <header className="sticky top-0 z-20 h-16 bg-[var(--glass-bg)] backdrop-blur-xl border-b border-[var(--border-subtle)] flex items-center justify-between px-4 sm:px-6 transition-all duration-300">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] cursor-pointer transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 text-xs sm:text-sm">
          <Link 
            to="/" 
            className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] font-semibold transition-colors hidden sm:inline flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)]" />
            Workspace
          </Link>
          <span className="text-[var(--text-muted)] hidden sm:inline font-mono opacity-50">/</span>
          <span className="font-bold text-[var(--text-primary)] tracking-tight">
            {getBreadcrumb()}
          </span>
        </div>
      </div>

      {/* Right: Recall Alert, Search Trigger & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {dueCount > 0 && (
          <Link
            to="/#recall"
            className="glow-badge-danger hover:scale-105 transition-transform"
            title={`${dueCount} problems due for FSRS spaced repetition review today`}
          >
            <Target className="w-3.5 h-3.5 animate-spin-slow" />
            <span className="hidden sm:inline">{dueCount} Recall Due</span>
            <span className="sm:hidden">{dueCount} Due</span>
          </Link>
        )}

        <button
          onClick={() => navigate('/problems')}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-all cursor-pointer shadow-xs hover:shadow-[var(--shadow-sm)]"
          title="Search problem library"
        >
          <Search className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
          <span className="hidden md:inline font-medium">Search library...</span>
          <kbd className="hidden md:inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] font-bold">
            /
          </kbd>
        </button>

        <ThemeSwitcher />

        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-[var(--border-subtle)] ml-1">
            <div
              className="w-8 h-8 rounded-xl bg-[var(--brand-gradient)] text-white text-xs font-bold flex items-center justify-center border border-[var(--border-accent)] shadow-xs ring-1 ring-[var(--brand-ring)]"
              title={`${user.name} (${user.email})`}
            >
              {getUserInitials(user.name)}
            </div>
            <span className="hidden lg:inline text-xs font-bold text-[var(--text-primary)] max-w-[110px] truncate">
              {user.name}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

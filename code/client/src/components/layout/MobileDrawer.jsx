import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  X,
  Zap,
  LogOut
} from 'lucide-react';
import ThemeSwitcher from '../common/ThemeSwitcher';
import { useAuth } from '../../context/AuthContext';
import { getUserInitials } from '../../utils/userDisplay';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', badge: 'Command' },
  { to: '/problems', icon: BookOpen, label: 'Problem Library', badge: '4,000+' },
  { to: '/patterns', icon: Layers, label: 'Pattern Mastery', badge: 'FSRS' },
];

export default function MobileDrawer({ open, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    onClose();
    navigate('/login', { replace: true });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex animate-fade-in">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-[300px] max-w-[85vw] bg-[var(--sidebar-bg)] backdrop-blur-2xl border-r border-[var(--border-subtle)] h-full flex flex-col justify-between p-5 z-10 shadow-2xl animate-slide-in">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--brand-gradient)] text-white flex items-center justify-center shadow-[var(--brand-glow)] ring-1 ring-[var(--brand-ring)]">
                <Zap className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight text-[var(--text-primary)] block">
                  CPRecal
                </span>
                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                  Spaced Repetition
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="py-4 space-y-1.5">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
              Navigation
            </div>
            {navItems.map(({ to, icon: Icon, label, badge }) => {
              const isActive = location.pathname === to;
              return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={`
                    flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all
                    ${isActive
                      ? 'bg-[var(--brand-light)] text-[var(--brand-primary)] border border-[var(--border-accent)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`} />
                    <span>{label}</span>
                  </div>
                  {badge && (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                      isActive 
                        ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] border-[var(--border-accent)]' 
                        : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                    }`}>
                      {badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
          {user && (
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
              <div className="w-8 h-8 rounded-lg bg-[var(--brand-gradient)] text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0 border border-[var(--border-accent)]">
                {getUserInitials(user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{user.name}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate font-mono">{user.email}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Theme</span>
            <ThemeSwitcher />
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-[var(--status-danger)] bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] hover:opacity-90 transition-all cursor-pointer shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

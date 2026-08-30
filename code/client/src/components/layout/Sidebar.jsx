import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getUserInitials } from '../../utils/userDisplay';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', badge: 'Command' },
  { to: '/problems', icon: BookOpen, label: 'Problem Library', badge: '4,000+' },
  { to: '/patterns', icon: Layers, label: 'Pattern Mastery', badge: 'FSRS' },
];

export default function Sidebar({ collapsed, setCollapsed, onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside
      className={`
        fixed top-0 left-0 h-screen z-30
        bg-[var(--sidebar-bg)] backdrop-blur-xl border-r border-[var(--border-subtle)]
        flex flex-col justify-between
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-[var(--sidebar-collapsed)]' : 'w-[var(--sidebar-width)]'}
        hidden lg:flex select-none shadow-[var(--shadow-card)]
      `}
    >
      {/* Brand Header */}
      <div>
        <div className={`h-16 flex items-center px-4 border-b border-[var(--border-subtle)] relative ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-gradient)] text-white flex items-center justify-center flex-shrink-0 shadow-[var(--brand-glow)] ring-2 ring-[var(--brand-ring)] transition-transform hover:scale-105">
              <Zap className="w-4.5 h-4.5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col animate-fade-in">
                <span className="font-extrabold text-base tracking-tight text-[var(--text-primary)] flex items-center gap-1.5">
                  CPRecal
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--brand-light)] text-[var(--brand-primary)] border border-[var(--border-accent)] font-bold">
                    v2.5
                  </span>
                </span>
                <span className="text-[10px] font-mono font-semibold text-[var(--text-muted)] tracking-wider uppercase">
                  Spaced Repetition
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5">
          {!collapsed && (
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
              Main Menu
            </div>
          )}
          {navItems.map(({ to, icon: Icon, label, badge }) => {
            const isActive = location.pathname === to;
            return (
              <NavLink
                key={to}
                to={to}
                onClick={onNavigate}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative
                  ${isActive
                    ? 'bg-[var(--brand-light)] text-[var(--brand-primary)] border border-[var(--border-accent)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }
                  ${collapsed ? 'justify-center px-0' : 'justify-between'}
                `}
                title={collapsed ? label : undefined}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="nav-active-indicator" />
                )}

                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'}`} />
                  {!collapsed && <span className="tracking-tight">{label}</span>}
                </div>

                {!collapsed && badge && (
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

      {/* Footer Section */}
      <div className="p-3 border-t border-[var(--border-subtle)] space-y-2.5">
        {/* User Card */}
        {user && (
          <div className={`rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-all hover:border-[var(--border-default)] ${collapsed ? 'p-2 flex justify-center' : 'px-3 py-2.5 flex items-center gap-2.5'}`}>
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-gradient)] text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0 shadow-xs ring-1 ring-[var(--brand-ring)]">
              {getUserInitials(user.name)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{user.name}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate font-mono">{user.email}</p>
              </div>
            )}
          </div>
        )}

        {/* Engine Status */}
        {!collapsed && (
          <div className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold">
              <span className="w-2 h-2 rounded-full bg-[var(--status-success)] animate-pulse" />
              FSRS Engine Active
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            onClick={handleLogout}
            className={`
              flex-1 flex items-center py-2 rounded-xl
              text-[var(--text-muted)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]
              text-xs font-semibold transition-all cursor-pointer border border-transparent hover:border-[var(--status-danger-border)]
              ${collapsed ? 'justify-center' : 'px-3 gap-2'}
            `}
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] text-xs font-medium transition-all cursor-pointer border border-[var(--border-subtle)]"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}

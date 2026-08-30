import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, ChevronDown } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeSwitcher({ className = '' }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const options = [
    { key: 'dark', label: 'Dark', icon: Moon },
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'system', label: 'System', icon: Laptop },
  ];

  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;

  const handleSelect = (key) => {
    setTheme(key);
    setOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-all cursor-pointer shadow-xs"
        title="Toggle color theme"
        aria-label="Toggle color theme"
        aria-expanded={open}
      >
        <CurrentIcon className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
        <span className="capitalize hidden sm:inline">{theme}</span>
        <ChevronDown 
          className="w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200" 
          style={{ transform: open ? 'rotate(180deg)' : 'none' }} 
        />
      </button>

      {open && (
        <div 
          className="absolute right-0 top-full mt-2 w-36 rounded-xl bg-[var(--bg-surface)] backdrop-blur-2xl border border-[var(--border-default)] shadow-[var(--shadow-dropdown)] p-1.5 z-50 animate-scale-in"
          style={{ background: 'var(--bg-surface)' }}
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
            Theme Mode
          </div>
          {options.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(key);
              }}
              onClick={() => handleSelect(key)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                theme === key
                  ? 'bg-[var(--brand-light)] text-[var(--brand-primary)] border border-[var(--border-accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </div>
              {theme === key && <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

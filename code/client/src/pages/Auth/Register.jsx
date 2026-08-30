import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Zap, ArrowRight, BrainCircuit } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeSwitcher from '../../components/common/ThemeSwitcher';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Please provide your name, email, and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between relative overflow-hidden selection:bg-[var(--brand-primary)] selection:text-white">
      {/* Background Ambient Lighting Orbs */}
      <div 
        className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none opacity-30 dark:opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)' }}
      />
      <div 
        className="fixed bottom-0 left-10 w-96 h-96 rounded-full pointer-events-none opacity-20 dark:opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, transparent 70%)' }}
      />

      <header className="h-16 flex items-center justify-between px-4 sm:px-8 border-b border-[var(--border-subtle)] bg-[var(--glass-bg)] backdrop-blur-xl relative z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--brand-gradient)] text-white flex items-center justify-center shadow-[var(--brand-glow)] ring-1 ring-[var(--brand-ring)]">
            <Zap className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-tight text-base flex items-center gap-1.5">
              CPRecal
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--brand-light)] text-[var(--brand-primary)] border border-[var(--border-accent)] font-bold">
                PRO
              </span>
            </span>
            <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider hidden sm:block">
              Spaced Repetition Platform
            </span>
          </div>
        </div>
        <ThemeSwitcher />
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10 animate-fade-up">
        <div className="w-full max-w-[440px] panel-card p-6 sm:p-8 space-y-6 shadow-2xl relative">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-light)] text-[var(--brand-primary)] text-[10px] font-mono font-bold tracking-wider uppercase mb-3 border border-[var(--border-accent)]">
              <BrainCircuit className="w-3 h-3" /> FSRS Retention Engine
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Create Account
            </h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
              Start building continuous algorithm retention with automated FSRS spaced repetition and problem mastery scoring.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-semibold text-[var(--status-danger)] shadow-xs animate-shake"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Full Name</span>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-control text-xs sm:text-sm"
                placeholder="Ada Lovelace"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Email Address</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-control text-xs sm:text-sm"
                placeholder="developer@example.com"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-control pr-10 text-xs sm:text-sm"
                  placeholder="At least 6 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Confirm Password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-control text-xs sm:text-sm"
                placeholder="Repeat password"
                required
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-2.5 text-xs sm:text-sm font-bold shadow-md mt-4 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Create Account & Start Learning</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-[var(--border-subtle)] text-center text-xs text-[var(--text-secondary)]">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-[var(--brand-primary)] hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-[11px] text-[var(--text-muted)] border-t border-[var(--border-subtle)] relative z-10 font-mono">
        CPRecal — Spaced Repetition Mastery Engine for LeetCode
      </footer>
    </div>
  );
}

import React, { useState } from 'react';
import { X, Shield, User as UserIcon, GraduationCap, Lock, Mail, UserPlus, LogIn, AlertTriangle, Play } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import type { Role } from '@/lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: Role) => void;
}

const ROLES: { id: Role; label: string; icon: typeof UserIcon; active: string }[] = [
  { id: 'student', label: 'Student', icon: UserIcon, active: 'bg-hero-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]' },
  { id: 'parent', label: 'Parent', icon: Shield, active: 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]' },
  { id: 'teacher', label: 'Teacher', icon: GraduationCap, active: 'bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.5)]' },
];

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { login, register, demoLogin, demoEnabled, googleClientId, googleLogin } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<Role>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const run = async (action: () => Promise<{ role: Role }>) => {
    setError(null);
    setLoading(true);
    try {
      const user = await action();
      onSuccess(user.role);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => (mode === 'login' ? login(email, password) : register(name, email, password, role)));
  };

  const inputClass =
    'w-full bg-ink-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-hero-500';
  const labelClass = 'block text-xs font-mono uppercase tracking-wider text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-ink-950 border border-hero-600/50 rounded-3xl p-6 sm:p-8 comic-shadow-red shadow-[0_0_50px_rgba(220,38,38,0.3)] text-white overflow-hidden max-h-[95vh] overflow-y-auto">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,0,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 p-2 text-gray-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10 text-center mb-6">
          <h2 className="font-comic text-3xl sm:text-4xl text-white tracking-wide text-stroke-white">
            {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            {mode === 'login'
              ? 'Welcome back to MathVerse.'
              : 'Students play missions. Parents and teachers follow their progress.'}
          </p>
        </div>

        {mode === 'register' && (
          <div className="relative z-10 grid grid-cols-3 gap-2 mb-6 p-1.5 bg-ink-900/90 rounded-2xl border border-white/10">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                aria-pressed={role === r.id}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  role === r.id ? `${r.active} text-white scale-[1.02]` : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <r.icon className="w-4 h-4 mb-1" />
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="relative z-10 mb-4 p-3.5 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-mono flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-name" className={labelClass}>Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="auth-name" type="text" required maxLength={80} value={name}
                  onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className={labelClass}>Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input id="auth-email" type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password" className={labelClass}>Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input id="auth-password" type="password" required
                minLength={mode === 'register' ? 8 : 1} maxLength={72}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>
            {mode === 'register' && <span className="text-[10px] text-gray-400 mt-1 block">At least 8 characters.</span>}
          </div>

          {mode === 'register' && role !== 'student' && (
            <p className="text-[11px] text-gray-400 leading-relaxed">
              After signing up you can connect to a student by entering the link code shown on their own dashboard.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-white bg-hero-600 hover:bg-hero-500 transition-all comic-shadow flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : mode === 'login' ? (
              <><LogIn className="w-4 h-4" /> Sign In</>
            ) : (
              <><UserPlus className="w-4 h-4" /> Create {role} account</>
            )}
          </button>
        </form>

        {/* Shown only when the server has a Google client ID set. */}
        {googleClientId && (
          <div className="relative z-10 mt-5" data-google-signin>
            <div className="flex items-center gap-3 mb-4 text-[11px] text-gray-500 uppercase tracking-wider">
              <span className="flex-1 h-px bg-white/10" /> or <span className="flex-1 h-px bg-white/10" />
            </div>
            <GoogleSignInButton
              clientId={googleClientId}
              text={mode === 'login' ? 'signin_with' : 'continue_with'}
              // Signing up: the role picked above. Signing in: none, so an existing account is used.
              onCredential={(credential) => run(() => googleLogin(credential, mode === 'register' ? role : undefined))}
            />
            {mode === 'register' && (
              <p className="text-[10px] text-gray-500 text-center mt-2">Creates a {role} account with your Google name and email.</p>
            )}
          </div>
        )}

        <div className="relative z-10 text-center mt-5 text-xs text-gray-400">
          {mode === 'login' ? 'Need an account? ' : 'Already registered? '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
            className="text-hero-400 hover:text-hero-300 font-bold underline"
          >
            {mode === 'login' ? 'Sign up here' : 'Log in'}
          </button>
        </div>

        {/* Shown only when the server has DEMO_MODE switched on. */}
        {demoEnabled && (
          <div className="relative z-10 mt-6 pt-5 border-t border-white/10">
            <p className="text-[11px] text-gray-400 text-center mb-3">
              Just looking? Try a demo account. It contains sample data only.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={loading}
                  onClick={() => run(() => demoLogin(r.id))}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-yellow-400/10 border border-yellow-400/40 text-yellow-300 hover:bg-yellow-400/20 transition-colors disabled:opacity-50"
                >
                  <Play className="w-3 h-3" /> Demo {r.label.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

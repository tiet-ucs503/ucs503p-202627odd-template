import React, { useEffect, useState } from 'react';
import {
  X, Shield, User as UserIcon, GraduationCap, Lock, Mail, UserPlus, LogIn, AlertTriangle, Play, KeyRound, Info,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { ApiError, type Role } from '@/lib/api';
import { emailProblem } from '@/lib/emailCheck';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: Role) => void;
}

type Mode = 'login' | 'register' | 'verify';

const ROLES: { id: Role; label: string; icon: typeof UserIcon; active: string }[] = [
  { id: 'student', label: 'Student', icon: UserIcon, active: 'bg-hero-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]' },
  { id: 'parent', label: 'Parent', icon: Shield, active: 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]' },
  { id: 'teacher', label: 'Teacher', icon: GraduationCap, active: 'bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.5)]' },
];

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const {
    login, register, verifyEmail, resendCode, demoLogin, demoEnabled, googleClientId, googleLogin,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<Role>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [resendIn, setResendIn] = useState(0);

  // Counts down the wait before another code may be requested.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  if (!isOpen) return null;

  const problems = {
    name: mode === 'register' && !name.trim() ? 'Enter your name.' : null,
    email: emailProblem(email),
    password: !password
      ? 'Enter your password.'
      : mode === 'register' && password.length < 8 ? 'Use at least 8 characters.' : null,
  };
  const showProblem = (field: keyof typeof problems) => (touched[field] ? problems[field] : null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setTouched({});
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true });
    if (problems.name || problems.email || problems.password) return;
    const cleanEmail = email.trim().toLowerCase();
    setEmail(cleanEmail);
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const user = await login(cleanEmail, password);
        onSuccess(user.role);
        onClose();
      } else {
        const pending = await register(name.trim(), cleanEmail, password, role);
        setCode('');
        setResendIn(pending.resend_after_seconds);
        setMode('verify');
        setNotice(
          pending.email_sent
            ? `We sent a 6-digit code to ${pending.email}. It expires in 15 minutes.`
            : `We could not send the email to ${pending.email} just now. Use "Send a new code" to try again.`,
        );
      }
    } catch (err) {
      if (mode === 'login' && err instanceof ApiError && err.status === 403) {
        // Right password, but the email was never confirmed.
        setCode('');
        setMode('verify');
        setNotice(`${err.message} The code goes to ${cleanEmail}.`);
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    run(() => verifyEmail(email, code));
  };

  const handleResend = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await resendCode(email);
      setResendIn(res.resend_after_seconds);
      setNotice(`A new code is on its way to ${email}. Check your spam folder if it does not arrive.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The code could not be sent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-ink-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-hero-500';
  const invalidClass = ' border-red-500/70';
  const labelClass = 'block text-xs font-mono uppercase tracking-wider text-gray-300 mb-1';
  const fieldError = (id: string, text: string | null) =>
    text ? <span id={id} className="text-[11px] text-red-300 mt-1 block">{text}</span> : null;

  const titles: Record<Mode, [string, string]> = {
    login: ['SIGN IN', 'Welcome back to MathVerse.'],
    register: ['CREATE ACCOUNT', 'Students play missions. Parents and teachers follow their progress.'],
    verify: ['CHECK YOUR EMAIL', 'Enter the code to finish setting up your account.'],
  };

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
          <h2 className="font-comic text-3xl sm:text-4xl text-white tracking-wide text-stroke-white">{titles[mode][0]}</h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">{titles[mode][1]}</p>
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
        {notice && (
          <div role="status" className="relative z-10 mb-4 p-3.5 rounded-2xl bg-blue-950/60 border border-blue-400/40 text-blue-100 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 text-blue-300 mt-0.5" />
            <div>{notice}</div>
          </div>
        )}

        {mode === 'verify' ? (
          <form onSubmit={handleVerify} noValidate className="relative z-10 space-y-4">
            <div>
              <label htmlFor="auth-code" className={labelClass}>6-digit code</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  placeholder="123456" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${inputClass} tracking-[0.4em] font-mono`}
                />
              </div>
              <span className="text-[10px] text-gray-400 mt-1 block">Not in your inbox? Check the spam folder.</span>
            </div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full py-3 px-4 rounded-xl font-bold text-white bg-hero-600 hover:bg-hero-500 transition-all comic-shadow flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <>Verify and continue</>}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={handleResend} disabled={loading || resendIn > 0}
                className="text-hero-400 hover:text-hero-300 font-bold underline disabled:text-gray-500 disabled:no-underline">
                {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
              </button>
              <button type="button" onClick={() => switchMode('register')} className="text-gray-400 hover:text-white underline">
                Use a different email
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="relative z-10 space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className={labelClass}>Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input id="auth-name" type="text" maxLength={80} value={name} autoComplete="name"
                    aria-invalid={!!showProblem('name')} aria-describedby={showProblem('name') ? 'auth-name-error' : undefined}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass + (showProblem('name') ? invalidClass : '')} />
                </div>
                {fieldError('auth-name-error', showProblem('name'))}
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className={labelClass}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="auth-email" type="email" autoComplete="email" maxLength={254} value={email}
                  aria-invalid={!!showProblem('email')} aria-describedby={showProblem('email') ? 'auth-email-error' : undefined}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass + (showProblem('email') ? invalidClass : '')} />
              </div>
              {fieldError('auth-email-error', showProblem('email'))}
            </div>

            <div>
              <label htmlFor="auth-password" className={labelClass}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="auth-password" type="password" maxLength={72}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  aria-invalid={!!showProblem('password')} aria-describedby={showProblem('password') ? 'auth-password-error' : undefined}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className={inputClass + (showProblem('password') ? invalidClass : '')} />
              </div>
              {fieldError('auth-password-error', showProblem('password')) ??
                (mode === 'register' && <span className="text-[10px] text-gray-400 mt-1 block">At least 8 characters.</span>)}
            </div>

            {mode === 'register' && (
              <p className="text-[11px] text-gray-400 leading-relaxed">
                We will email you a 6-digit code to confirm the address.
                {role !== 'student' && ' After signing up you can connect to a student by entering the link code shown on their own dashboard.'}
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
        )}

        {/* Shown only when the server has a Google client ID set. Google confirms the email itself. */}
        {googleClientId && mode !== 'verify' && (
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
              <p className="text-[10px] text-gray-500 text-center mt-2">Creates a {role} account with your Google name and email. No code needed.</p>
            )}
          </div>
        )}

        {mode !== 'verify' && (
          <div className="relative z-10 text-center mt-5 text-xs text-gray-400">
            {mode === 'login' ? 'Need an account? ' : 'Already registered? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="text-hero-400 hover:text-hero-300 font-bold underline"
            >
              {mode === 'login' ? 'Sign up here' : 'Log in'}
            </button>
          </div>
        )}

        {/* Shown only when the server has DEMO_MODE switched on. */}
        {demoEnabled && mode !== 'verify' && (
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

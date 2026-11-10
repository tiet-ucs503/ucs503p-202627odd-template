import React, { useState } from 'react';
import { X, Shield, User as UserIcon, GraduationCap, Lock, Mail, UserPlus, LogIn, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: 'student' | 'parent' | 'teacher') => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { login, register } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'student' | 'parent' | 'teacher'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && (role === 'parent' || role === 'teacher') && !studentEmail.trim()) {
      setError("Please provide your student's registered email address to link their dashboard.");
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const u = await login(email, password);
        onSuccess(u.role);
        onClose();
      } else {
        const u = await register(name, email, password, role, studentEmail);
        onSuccess(u.role);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-ink-950 border border-hero-600/50 rounded-3xl p-6 sm:p-8 comic-shadow-red shadow-[0_0_50px_rgba(220,38,38,0.3)] text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Spider background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,0,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-gray-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="relative z-10 text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-hero-600/20 border border-hero-500/40 text-hero-400 text-xs font-mono font-bold uppercase tracking-widest mb-2">
            <Shield className="w-3.5 h-3.5 text-hero-400" /> MathVerse Security Portal
          </div>
          <h2 className="font-comic text-3xl sm:text-4xl text-white tracking-wide text-stroke-white">
            {mode === 'login' ? 'AUTHENTICATE ACCESS' : 'ENROLL NEW HERO'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Sign in to access your customized learning telemetry & missions.
          </p>
        </div>

        {/* Role Tabs */}
        <div className="relative z-10 grid grid-cols-3 gap-2 mb-6 p-1.5 bg-ink-900/90 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setRole('student')}
            className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
              role === 'student'
                ? 'bg-hero-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] scale-[1.02]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <UserIcon className="w-4 h-4 mb-1" />
            <span>Student</span>
          </button>

          <button
            type="button"
            onClick={() => setRole('parent')}
            className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
              role === 'parent'
                ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-[1.02]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Shield className="w-4 h-4 mb-1" />
            <span>Parent</span>
          </button>

          <button
            type="button"
            onClick={() => setRole('teacher')}
            className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
              role === 'teacher'
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)] scale-[1.02]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <GraduationCap className="w-4 h-4 mb-1" />
            <span>Teacher</span>
          </button>
        </div>

        {/* Error Alert / Sign-Up Prompt */}
        {error && (
          <div className="relative z-10 mb-4 p-3.5 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-mono flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <div>{error}</div>
              {error.toLowerCase().includes('sign up') && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-hero-600 hover:bg-hero-500 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Switch to Sign Up
                </button>
              )}
            </div>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder={role === 'student' ? 'Peter Parker' : (role === 'parent' ? 'May Parker' : 'Dr. Curt Connors')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-ink-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-hero-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                placeholder={role === 'student' ? 'peter@mathverse.edu' : (role === 'parent' ? 'may@mathverse.edu' : 'connors@mathverse.edu')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-ink-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-hero-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-ink-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-hero-500"
              />
            </div>
          </div>

          {mode === 'register' && (role === 'parent' || role === 'teacher') && (
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 mb-1">
                Student&apos;s Registered Email Address <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  placeholder="e.g. child@mathverse.edu"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full bg-ink-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-hero-500 font-mono"
                />
              </div>
              <span className="text-[10px] text-gray-400 mt-1 block">
                Required: Enter your student&apos;s registered email. Guardians can only access their authorized student&apos;s dashboard.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-white bg-hero-600 hover:bg-hero-500 transition-all comic-shadow flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" /> Sign In as {role.toUpperCase()}
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Create {role.toUpperCase()} Account
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="relative z-10 text-center mt-5 text-xs text-gray-400">
          {mode === 'login' ? (
            <p>
              Need an account?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-hero-400 hover:text-hero-300 font-bold underline"
              >
                Sign Up Here
              </button>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-hero-400 hover:text-hero-300 font-bold underline"
              >
                Log In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


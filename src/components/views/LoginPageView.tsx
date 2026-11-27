import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ThaparLogo } from '../ThaparLogo';
import { evaluatePasswordPolicy } from '../../lib/passwordPolicy';
import { supabaseClient, apiFetch } from '../../lib/supabaseClient';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Check,
  X,
  Loader2,
  ShieldAlert
} from 'lucide-react';

interface LoginPageViewProps {
  onSuccessLogin: (workspaces?: any[]) => void;
}

type AuthScreenMode = 'login' | 'register' | 'pending_approval' | 'forgot_password' | 'forgot_success' | 'reset_password' | 'reset_success' | 'recovery_invalid';

export function LoginPageView({ onSuccessLogin }: LoginPageViewProps) {
  const {
    login,
    register,
    loginAsDemoRole,
    requestPasswordReset,
    resetPassword
  } = useAuth();

  // Screen Mode: 'login' | 'register' | 'forgot_password' | 'reset_password'
  const [screenMode, setScreenMode] = useState<AuthScreenMode>('login');

  // Login Form States (blank by default, zero prefilled values)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register Form States (blank by default, zero prefilled values)
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRoleCode, setRegRoleCode] = useState<'STUDENT' | 'FACULTY' | 'COORDINATOR'>('STUDENT');
  const [pendingApprovalEmail, setPendingApprovalEmail] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Forgot Password & OTP States
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Reset Password States
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetSuccessDone, setResetSuccessDone] = useState(false);

  // Status & Loading States
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [demoRoleLoading, setDemoRoleLoading] = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/google/status', { credentials: 'same-origin' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((status) => { if (active) setGoogleConfigured(status?.configured === true); })
      .catch(() => { if (active) setGoogleConfigured(false); });
    return () => { active = false; };
  }, []);

  // Password Policy Checks (Strict: 12+ chars, uppercase, lowercase, number, symbol)
  const regPasswordPolicy = evaluatePasswordPolicy(regPassword);
  const resetPasswordPolicy = evaluatePasswordPolicy(newPassword);

  const handleDemoLoginClick = async (
    roleKey: 'Coordinator' | 'Faculty' | 'Student' | 'HOD' | 'Admin'
  ) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setDemoRoleLoading(roleKey);

    try {
      const res = await loginAsDemoRole(roleKey);
      setDemoRoleLoading(null);
      if (res.success && res.authorizedWorkspaces) {
        setSuccessMessage(`Authenticated as ${roleKey} presentation account`);
        onSuccessLogin?.(res.authorizedWorkspaces);
      } else {
        setErrorMessage(res.message || 'Failed to authenticate demo account.');
      }
    } catch {
      setDemoRoleLoading(null);
      setErrorMessage('Network error during demo authentication.');
    }
  };

  // Check URL parameters for OAuth errors or completed callbacks on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      setErrorMessage(decodeURIComponent(authError));
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Verify the application session cookie (e.g. after returning from Google OAuth).
    const checkSession = async () => {
      try {
        const resp = await fetch('/api/auth/me', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.authenticated && data.user) {
            const workspaces = data.authorizedWorkspaces || data.user.authorizedWorkspaces;
            onSuccessLogin(workspaces);
          }
        }
      } catch {
        // Not authenticated, remain on login
      }
    };
    checkSession();

    // Listen for cross-origin popup postMessage events from OAuth callback
    const handleAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setIsGoogleLoading(true);
        setErrorMessage(null);
        setSuccessMessage('Google authentication successful! Loading dashboard...');
        
        try {
          const resp = await fetch('/api/auth/me', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.authenticated && data.user) {
              const workspaces = data.authorizedWorkspaces || data.user.authorizedWorkspaces;
              setTimeout(() => {
                onSuccessLogin(workspaces);
              }, 300);
              return;
            }
          }
          setErrorMessage('Google sign-in finished, but the application session could not be verified. Please try again.');
        } catch {
          setErrorMessage('Could not verify the Google sign-in session. Please try again.');
        } finally {
          setIsGoogleLoading(false);
        }
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        setIsGoogleLoading(false);
        setErrorMessage(event.data.message || 'Google sign-in could not be completed. Please try again.');
      }
    };

    window.addEventListener('message', handleAuthMessage);

    // Check Supabase recovery link session on mount
    const checkSupabaseRecovery = async () => {
      const hash = window.location.hash;
      const search = window.location.search;
      const isRecoveryUrl =
        hash.includes('type=recovery') ||
        hash.includes('access_token=') ||
        hash.includes('token_hash=') ||
        search.includes('type=recovery') ||
        search.includes('code=');

      if (isRecoveryUrl) {
        setScreenMode('reset_password');
      }

      if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && isRecoveryUrl) {
          setScreenMode('reset_password');
        } else if (isRecoveryUrl && !session) {
          setTimeout(async () => {
            const { data } = await supabaseClient?.auth.getSession() || { data: { session: null } };
            if (!data.session) {
              setScreenMode('recovery_invalid');
            }
          }, 1200);
        }

        const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isRecoveryUrl)) {
            setScreenMode('reset_password');
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      }
    };
    checkSupabaseRecovery();

    return () => window.removeEventListener('message', handleAuthMessage);
  }, [onSuccessLogin]);

  // Password Requirement Checks
  const reqLength = newPassword.length >= 8;
  const reqUpper = /[A-Z]/.test(newPassword);
  const reqLower = /[a-z]/.test(newPassword);
  const reqNumber = /[0-9]/.test(newPassword);
  const reqSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const allReqsMet = reqLength && reqUpper && reqLower && reqNumber && reqSpecial;

  const switchMode = (newMode: AuthScreenMode) => {
    setScreenMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setResetSuccessDone(false);
  };

  /**
   * Handle Email/Password Login Submit (POST /api/auth/login)
   * CRITICAL: Must NEVER trigger Google OAuth or redirect to Google on failure.
   */
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const emailTrim = loginEmail.trim();
    if (!emailTrim) {
      setErrorMessage('Please enter your email.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await login(emailTrim, loginPassword);
      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          onSuccessLogin(res.authorizedWorkspaces);
        }, 350);
      } else {
        if (res.pendingApproval) {
          setPendingApprovalEmail(emailTrim);
          setScreenMode('pending_approval');
          return;
        }
        // Remain on login page and display safe error. Never trigger Google OAuth!
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage('Network error connecting to authentication API.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Google OAuth Initiation
   * Triggered ONLY when the user explicitly clicks "Continue with Google".
   * Opens in popup to prevent studio.google.com iframe sandbox navigation blocks.
   */
  const handleGoogleClick = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGoogleLoading(true);

    try {
      const resp = await fetch('/api/auth/google/authorize', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await resp.json();

        if (resp.ok && data.success && data.redirectUrl) {
          // Calculate centered popup coordinates
          const width = 520;
          const height = 650;
          const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
          const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

          const popup = window.open(
            data.redirectUrl,
            'google_oauth_popup',
            `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
          );

          if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            // If popup is blocked by browser, fallback to standard top-level navigation
            window.location.href = data.redirectUrl;
          }
          return;
        }
        setErrorMessage(data.message || 'Google sign-in could not be started. Please try again.');
        setIsGoogleLoading(false);
        return;
      }
      setErrorMessage('Google sign-in returned an unexpected response. Please try again.');
      setIsGoogleLoading(false);
    } catch {
      setIsGoogleLoading(false);
      setErrorMessage('Google sign-in is unavailable right now. Please try again later.');
    }
  };

  /**
   * Handle Register Submit (POST /api/auth/register)
   * Enforces 12+ chars, uppercase, lowercase, number, symbol policy
   * Creates a pending account request; sign-in is enabled only after Admin approval.
   */
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const nameTrim = regFullName.trim();
    const emailTrim = regEmail.trim();

    if (!nameTrim || !emailTrim || !regPassword) {
      setErrorMessage('All fields are required.');
      return;
    }
    
    // Authoritative password policy validation
    if (!regPasswordPolicy.isValid) {
      setErrorMessage(`Password must satisfy all security requirements: ${regPasswordPolicy.errors.join(', ')}.`);
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await register(nameTrim, emailTrim, regPassword, regRoleCode);
      if (res.success) {
        if (res.status === 'PENDING') {
          setPendingApprovalEmail(res.email || emailTrim);
          setRegPassword('');
          setRegConfirmPassword('');
          setScreenMode('pending_approval');
          return;
        }
        setLoginEmail(res.email || emailTrim);
        setLoginPassword('');
        setRegPassword('');
        setRegConfirmPassword('');
        const signIn = await login(emailTrim, regPassword);
        if (signIn.success) {
          onSuccessLogin(signIn.authorizedWorkspaces);
        } else {
          setScreenMode('login');
          setErrorMessage(`Your account was created, but sign-in did not complete. ${signIn.message} You can sign in below.`);
        }
      } else {
        setErrorMessage(res.message || 'Registration failed.');
      }
    } catch {
      setErrorMessage('Failed to create account. Please verify your details.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Forgot Password Submit (Step 1: Request OTP)
   */
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const emailTrim = forgotEmail.trim();
    if (!emailTrim) {
      setErrorMessage('Please enter your email.');
      return;
    }

    setIsLoading(true);

    try {
      if (supabaseClient) {
        console.info('[AUTH RECOVERY] request started');
        const redirectToUrl = window.location.origin;

        const { data, error } = await supabaseClient.auth.resetPasswordForEmail(emailTrim, {
          redirectTo: redirectToUrl,
        });

        if (error) {
          console.warn('[AUTH RECOVERY] Supabase request failed:', error.message || error);
        } else {
          console.info('[AUTH RECOVERY] Supabase request succeeded');
        }
      } else {
        console.info('[AUTH RECOVERY] request started (backend fallback)');
        await apiFetch('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: emailTrim }),
        }).catch(() => {});
        console.info('[AUTH RECOVERY] backend request succeeded');
      }

      setSuccessMessage("If an account exists for this email, we've sent password-reset instructions.");
      setScreenMode('forgot_success');
    } catch (err: any) {
      console.warn('[AUTH RECOVERY] Supabase request exception:', err?.message || err);
      // Never reveal account existence
      setSuccessMessage("If an account exists for this email, we've sent password-reset instructions.");
      setScreenMode('forgot_success');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Verify OTP (Step 2: Verify 6-digit OTP token)
   */
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const otpStr = otpDigits.join('');
    if (otpStr.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);

    try {
      if (supabaseClient) {
        const { error } = await supabaseClient.auth.verifyOtp({
          email: forgotEmail.trim(),
          token: otpStr,
          type: 'recovery',
        });
        if (error) throw error;
      } else {
        const res = await apiFetch('/api/auth/validate-token', {
          method: 'POST',
          body: JSON.stringify({ email: forgotEmail.trim(), token: otpStr }),
        });
        if (!res.success) throw new Error(res.message || 'Invalid verification code.');
      }

      setSuccessMessage('Verification code confirmed successfully.');
      setScreenMode('reset_password');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Resend OTP
   */
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (supabaseClient) {
        await supabaseClient.auth.resetPasswordForEmail(forgotEmail.trim(), {
          redirectTo: window.location.origin,
        });
      }
      setSuccessMessage('A new verification code has been sent.');
      setResendCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
    } catch {
      setSuccessMessage('A new verification code has been sent.');
      setResendCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Reset Password Submit (Step 3: Update Password)
   */
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!resetPasswordPolicy.isValid) {
      setErrorMessage(`Please ensure your new password meets all security criteria: ${resetPasswordPolicy.errors.join(', ')}.`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          setScreenMode('recovery_invalid');
          setIsLoading(false);
          return;
        }

        const { error } = await supabaseClient.auth.updateUser({
          password: newPassword,
        });
        if (error) throw error;
      } else {
        await apiFetch('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email: forgotEmail.trim(), password: newPassword }),
        });
      }

      setScreenMode('reset_success');
      setSuccessMessage('Password reset successfully.');
      setLoginEmail('');
      setLoginPassword('');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err: any) {
      const msg = err?.message || 'Failed to update password. Please try again.';
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('session') || msg.toLowerCase().includes('auth')) {
        setScreenMode('recovery_invalid');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="study-login min-h-screen w-full bg-[#F7F6F2] dark:bg-[#0c0c0e] text-stone-900 dark:text-zinc-100 flex flex-col justify-center items-center p-3 sm:p-4 font-sans relative overflow-x-hidden selection:bg-[#8C1B2E]/20 selection:text-[#8C1B2E]">
      <div className="study-login-story" aria-hidden="true">
        <div className="study-story-kicker"><span className="study-live-dot" /> TIET · ACADEMIC LIFE, IN RHYTHM</div>
        <h1>Make room<br />for <em>what’s next.</em></h1>
        <p className="study-story-copy">Your week, your classes, your campus — all moving together.</p>
        <div className="study-course-stack">
          <div className="study-course-card study-course-one"><span>MON · 09:00</span><strong>Data Structures</strong><small>CS 201 · LH 3</small></div>
          <div className="study-course-card study-course-two"><span>TUE · 11:00</span><strong>Design Studio</strong><small>DES 104 · Studio B</small></div>
          <div className="study-course-card study-course-three"><span>THU · 14:00</span><strong>Signals &amp; Systems</strong><small>EC 204 · Block C</small></div>
        </div>
        <div className="study-story-foot"><span>ONE CAMPUS, EVERY CLASS</span><span>01 / 05</span></div>
      </div>
      {/* Main Centered Minimal Card */}
      <div className="study-login-card w-full max-w-[430px] max-h-[calc(100vh-1.5rem)] overflow-y-auto bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs relative z-10 transition-all">
        {/* Thapar Brand Header - Primary visual identity */}
        <div className="mb-6 text-center">
          <ThaparLogo size="md" variant="full" />
        </div>

        {/* Global Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 p-3 bg-rose-50/80 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5 shadow-2xs"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-[#8C1B2E] dark:text-red-400 mt-0.5" />
            <div className="leading-relaxed font-medium">
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Global Success Alert */}
        {successMessage && (
          <div
            role="status"
            className="mb-4 p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: LOGIN                                            */}
        {/* ======================================================== */}
        {screenMode === 'login' && (
          <div>
            <div className="text-center space-y-1.5 mb-6">
              <h2 className="text-xl font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
                Sign in to your account
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                Use your institutional email and password.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} autoComplete="off" className="space-y-4">
              {/* Email (Label exactly "Email") */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-xs font-medium text-stone-700 dark:text-zinc-300 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-stone-400 dark:text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    disabled={isLoading || isGoogleLoading}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 focus:border-[#8C1B2E] focus:ring-1 focus:ring-[#8C1B2E] rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-900 dark:text-zinc-100 outline-none transition-all disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reg-role" className="text-xs font-medium text-stone-700 dark:text-zinc-300 block">Request role</label>
                <select id="reg-role" value={regRoleCode} onChange={event => setRegRoleCode(event.target.value as typeof regRoleCode)} disabled={isLoading} className="w-full rounded-xl border border-[#E5E2D9] bg-white px-3 py-2.5 text-xs text-stone-900 outline-none focus:border-[#8C1B2E] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                  <option value="STUDENT">Student</option>
                  <option value="FACULTY">Faculty</option>
                  <option value="HOD">HOD (Head of Department)</option>
                </select>
                <p className="text-[10px] text-stone-500 dark:text-zinc-400">An Admin must approve the requested role before you can sign in.</p>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="login-password" className="font-medium text-stone-700 dark:text-zinc-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot_password')}
                    className="text-[#8C1B2E] dark:text-red-400 hover:text-[#721525] dark:hover:text-red-300 text-[11px] font-medium transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="h-4 w-4 text-stone-400 dark:text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    disabled={isLoading || isGoogleLoading}
                    autoComplete="current-password"
                    className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 focus:border-[#8C1B2E] focus:ring-1 focus:ring-[#8C1B2E] rounded-xl pl-10 pr-10 py-2.5 text-xs text-stone-900 dark:text-zinc-100 outline-none transition-all disabled:opacity-50 tracking-normal"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-8 min-w-8 inline-flex items-center justify-center rounded-md text-stone-400 hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C1B2E]"
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showLoginPassword}
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center text-xs text-stone-600 dark:text-zinc-400 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="rounded bg-white dark:bg-zinc-950 border-[#E5E2D9] dark:border-zinc-800 text-[#8C1B2E] focus:ring-[#8C1B2E]"
                  />
                  <span>Remember me on this device</span>
                </label>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full py-2.5 bg-[#8C1B2E] hover:bg-[#721525] active:bg-[#5a111e] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {googleConfigured && <>
            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5E2D9] dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#FAF9F5] dark:bg-zinc-900 px-3 text-stone-500 dark:text-zinc-400 font-medium">or</span>
              </div>
            </div>

            {/* Continue with Google button (Real Google OAuth, isolated trigger) */}
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={isLoading || isGoogleLoading}
              className="w-full py-2.5 bg-white dark:bg-zinc-950 hover:bg-stone-50 dark:hover:bg-zinc-850 active:bg-stone-100 disabled:opacity-60 disabled:cursor-not-allowed text-stone-800 dark:text-zinc-100 border border-[#E5E2D9] dark:border-zinc-700 hover:border-stone-400 dark:hover:border-zinc-600 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2.5 shadow-2xs"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
            </>}

            {/* Presentation role switcher */}
            <div className="mt-6 pt-5 border-t border-[#E5E2D9] dark:border-zinc-800/80">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                  <span className="text-xs font-semibold text-stone-800 dark:text-zinc-200">Presentation Role Switcher</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDemoModal(true)}
                  className="text-[11px] text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline transition-colors"
                >
                  Account details
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:auto-rows-fr lg:grid-cols-6">
                <button
                  type="button"
                  onClick={() => handleDemoLoginClick('Coordinator')}
                  disabled={Boolean(demoRoleLoading) || isLoading || isGoogleLoading}
                  className="h-full min-h-[88px] p-2.5 bg-white dark:bg-zinc-950 hover:bg-stone-50 dark:hover:bg-zinc-800 active:bg-stone-100 disabled:bg-stone-200 dark:disabled:bg-zinc-700 disabled:opacity-100 disabled:cursor-wait text-left border border-[#E5E2D9] dark:border-zinc-800 hover:border-stone-400 dark:hover:border-zinc-700 rounded-lg transition-all flex flex-col gap-0.5 group focus:outline-none focus-visible:ring-1 focus-visible:ring-[#8C1B2E] shadow-2xs lg:col-span-2"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-stone-900 dark:text-zinc-200 group-hover:text-[#8C1B2E] dark:group-hover:text-white group-disabled:text-stone-800 dark:group-disabled:text-zinc-100 transition-colors">Continue as HOD (Scheduling)</span>
                    {demoRoleLoading === 'Coordinator' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-600 dark:text-zinc-200" />
                    ) : (
                      <ArrowRight className="h-3 w-3 text-stone-400 group-hover:text-[#8C1B2E] transition-colors" />
                    )}
                  </div>
                  <span className="text-[10px] text-stone-600 dark:text-zinc-300 group-disabled:text-stone-700 dark:group-disabled:text-zinc-200">Full solver, rules & publishing</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoLoginClick('Faculty')}
                  disabled={Boolean(demoRoleLoading) || isLoading || isGoogleLoading}
                  className="h-full min-h-[88px] p-2.5 bg-white dark:bg-zinc-950 hover:bg-stone-50 dark:hover:bg-zinc-800 active:bg-stone-100 disabled:bg-stone-200 dark:disabled:bg-zinc-700 disabled:opacity-100 disabled:cursor-wait text-left border border-[#E5E2D9] dark:border-zinc-800 hover:border-stone-400 dark:hover:border-zinc-700 rounded-lg transition-all flex flex-col gap-0.5 group focus:outline-none focus-visible:ring-1 focus-visible:ring-[#8C1B2E] shadow-2xs lg:col-span-2"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-stone-900 dark:text-zinc-200 group-hover:text-[#8C1B2E] dark:group-hover:text-white group-disabled:text-stone-800 dark:group-disabled:text-zinc-100 transition-colors">Continue as Faculty</span>
                    {demoRoleLoading === 'Faculty' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-600 dark:text-zinc-200" />
                    ) : (
                      <ArrowRight className="h-3 w-3 text-stone-400 group-hover:text-[#8C1B2E] transition-colors" />
                    )}
                  </div>
                  <span className="text-[10px] text-stone-600 dark:text-zinc-300 group-disabled:text-stone-700 dark:group-disabled:text-zinc-200">Teaching routine & room schedule</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoLoginClick('Student')}
                  disabled={Boolean(demoRoleLoading) || isLoading || isGoogleLoading}
                  className="h-full min-h-[88px] p-2.5 bg-white dark:bg-zinc-950 hover:bg-stone-50 dark:hover:bg-zinc-800 active:bg-stone-100 disabled:bg-stone-200 dark:disabled:bg-zinc-700 disabled:opacity-100 disabled:cursor-wait text-left border border-[#E5E2D9] dark:border-zinc-800 hover:border-stone-400 dark:hover:border-zinc-700 rounded-lg transition-all flex flex-col gap-0.5 group focus:outline-none focus-visible:ring-1 focus-visible:ring-[#8C1B2E] shadow-2xs lg:col-span-2"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-stone-900 dark:text-zinc-200 group-hover:text-[#8C1B2E] dark:group-hover:text-white group-disabled:text-stone-800 dark:group-disabled:text-zinc-100 transition-colors">Continue as Student</span>
                    {demoRoleLoading === 'Student' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-600 dark:text-zinc-200" />
                    ) : (
                      <ArrowRight className="h-3 w-3 text-stone-400 group-hover:text-[#8C1B2E] transition-colors" />
                    )}
                  </div>
                  <span className="text-[10px] text-stone-600 dark:text-zinc-300 group-disabled:text-stone-700 dark:group-disabled:text-zinc-200">Weekly classes & course details</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoLoginClick('Admin')}
                  disabled={Boolean(demoRoleLoading) || isLoading || isGoogleLoading}
                  className="h-full min-h-[88px] p-2.5 bg-white dark:bg-zinc-950 hover:bg-stone-50 dark:hover:bg-zinc-800 active:bg-stone-100 disabled:bg-stone-200 dark:disabled:bg-zinc-700 disabled:opacity-100 disabled:cursor-wait text-left border border-[#E5E2D9] dark:border-zinc-800 hover:border-stone-400 dark:hover:border-zinc-700 rounded-lg transition-all flex flex-col gap-0.5 group focus:outline-none focus-visible:ring-1 focus-visible:ring-[#8C1B2E] shadow-2xs lg:col-span-2 lg:col-start-2"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-stone-900 dark:text-zinc-200 group-hover:text-[#8C1B2E] dark:group-hover:text-white group-disabled:text-stone-800 dark:group-disabled:text-zinc-100 transition-colors">Continue as Admin</span>
                    {demoRoleLoading === 'Admin' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-600 dark:text-zinc-200" />
                    ) : (
                      <ArrowRight className="h-3 w-3 text-stone-400 group-hover:text-[#8C1B2E] transition-colors" />
                    )}
                  </div>
                  <span className="text-[10px] text-stone-600 dark:text-zinc-300 group-disabled:text-stone-700 dark:group-disabled:text-zinc-200">Dean office & master approvals</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoLoginClick('HOD')}
                  disabled={Boolean(demoRoleLoading) || isLoading || isGoogleLoading}
                  className="h-full min-h-[88px] p-2.5 bg-white dark:bg-zinc-950 hover:bg-stone-50 dark:hover:bg-zinc-800 active:bg-stone-100 disabled:bg-stone-200 dark:disabled:bg-zinc-700 disabled:opacity-100 disabled:cursor-wait text-left border border-[#E5E2D9] dark:border-zinc-800 hover:border-stone-400 dark:hover:border-zinc-700 rounded-lg transition-all flex flex-col gap-0.5 group focus:outline-none focus-visible:ring-1 focus-visible:ring-[#8C1B2E] shadow-2xs lg:col-span-2 lg:col-start-4"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-stone-900 dark:text-zinc-200 group-hover:text-[#8C1B2E] dark:group-hover:text-white group-disabled:text-stone-800 dark:group-disabled:text-zinc-100 transition-colors">Continue as HOD</span>
                    {demoRoleLoading === 'HOD' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-600 dark:text-zinc-200" />
                    ) : (
                      <ArrowRight className="h-3 w-3 text-stone-400 group-hover:text-[#8C1B2E] transition-colors" />
                    )}
                  </div>
                  <span className="text-[10px] text-stone-600 dark:text-zinc-300 group-disabled:text-stone-700 dark:group-disabled:text-zinc-200">Department load balance & syllabus tracking</span>
                </button>
              </div>
            </div>

            {/* Bottom Register Switcher Link */}
            <div className="mt-6 pt-5 border-t border-[#E5E2D9] dark:border-zinc-800/80 text-center text-xs text-stone-500 dark:text-zinc-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="text-[#8C1B2E] dark:text-red-400 hover:text-[#721525] dark:hover:text-red-300 font-semibold transition-colors"
              >
                Register
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: REGISTER                                         */}
        {/* ======================================================== */}
        {screenMode === 'register' && (
          <div>
            <div className="text-center space-y-1 mb-4">
              <h2 className="text-lg font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
                Register
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                Create your institutional account
              </p>
            </div>

            <form onSubmit={handleRegisterSubmit} autoComplete="off" className="space-y-3.5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label htmlFor="reg-name" className="text-xs font-medium text-stone-700 dark:text-zinc-300 block">
                  Full Name
                </label>
                <div className="relative">
                  <User className="h-4 w-4 text-stone-400 dark:text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    id="reg-name"
                    type="text"
                    value={regFullName}
                    onChange={e => setRegFullName(e.target.value)}
                    disabled={isLoading}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 focus:border-[#8C1B2E] focus:ring-1 focus:ring-[#8C1B2E] rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-900 dark:text-zinc-100 outline-none transition-all disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              {/* Email (Label exactly "Email") */}
              <div className="space-y-1.5">
                <label htmlFor="reg-email" className="text-xs font-medium text-stone-700 dark:text-zinc-300 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-stone-400 dark:text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 focus:border-[#8C1B2E] focus:ring-1 focus:ring-[#8C1B2E] rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-900 dark:text-zinc-100 outline-none transition-all disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="reg-pwd" className="text-xs font-medium text-stone-700 dark:text-zinc-300 block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-stone-400 dark:text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    id="reg-pwd"
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 focus:border-[#8C1B2E] focus:ring-1 focus:ring-[#8C1B2E] rounded-xl pl-10 pr-10 py-2.5 text-xs text-stone-900 dark:text-zinc-100 outline-none transition-all disabled:opacity-50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3.5 top-2.5 text-stone-400 hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors p-0.5"
                    aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showRegPassword}
                  >
                    {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Live Password Strength Indicator (Supplemental) */}
                {regPassword && (
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-500 dark:text-zinc-400">Strength:</span>
                      <span
                        className={`font-semibold capitalize ${
                          regPasswordPolicy.strength === 'strong'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : regPasswordPolicy.strength === 'fair'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {regPasswordPolicy.strength}
                      </span>
                    </div>
                    <div className="w-full bg-stone-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden flex gap-1">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          regPasswordPolicy.strength === 'strong'
                            ? 'bg-emerald-500 w-full'
                            : regPasswordPolicy.strength === 'fair'
                            ? 'bg-amber-500 w-2/3'
                            : 'bg-rose-500 w-1/3'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Live Password Requirements Checklist */}
                <div className="p-2.5 bg-[#F4F2EC] dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800/80 rounded-xl space-y-1.5 text-[11px] mt-1.5">
                  <div className="text-[10px] font-mono text-stone-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
                    Password requirements
                  </div>
                  <div className="space-y-1">
                    <div className={`flex items-center gap-1.5 ${regPasswordPolicy.length ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-stone-500 dark:text-zinc-400'}`}>
                      {regPasswordPolicy.length ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <div className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-zinc-600 ml-1 mr-0.5 shrink-0" />}
                      <span>At least 12 characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${regPasswordPolicy.uppercase ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-stone-500 dark:text-zinc-400'}`}>
                      {regPasswordPolicy.uppercase ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <div className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-zinc-600 ml-1 mr-0.5 shrink-0" />}
                      <span>One uppercase letter</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${regPasswordPolicy.lowercase ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-stone-500 dark:text-zinc-400'}`}>
                      {regPasswordPolicy.lowercase ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <div className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-zinc-600 ml-1 mr-0.5 shrink-0" />}
                      <span>One lowercase letter</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${regPasswordPolicy.number ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-stone-500 dark:text-zinc-400'}`}>
                      {regPasswordPolicy.number ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <div className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-zinc-600 ml-1 mr-0.5 shrink-0" />}
                      <span>One number</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${regPasswordPolicy.special ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-stone-500 dark:text-zinc-400'}`}>
                      {regPasswordPolicy.special ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <div className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-zinc-600 ml-1 mr-0.5 shrink-0" />}
                      <span>One special character</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label htmlFor="reg-confirm-pwd" className="text-xs font-medium text-stone-700 dark:text-zinc-300 block">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-stone-400 dark:text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    id="reg-confirm-pwd"
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={e => setRegConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 focus:border-[#8C1B2E] focus:ring-1 focus:ring-[#8C1B2E] rounded-xl pl-10 pr-10 py-2.5 text-xs text-stone-900 dark:text-zinc-100 outline-none transition-all disabled:opacity-50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                    className="absolute right-3.5 top-2.5 text-stone-400 hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors p-0.5"
                    aria-label={showRegConfirmPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showRegConfirmPassword}
                  >
                    {showRegConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {regConfirmPassword && regPassword !== regConfirmPassword && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 pt-0.5">
                    Passwords do not match.
                  </p>
                )}
              </div>

              {/* Create Account Button */}
              <button
                type="submit"
                disabled={isLoading || !regPasswordPolicy.isValid || (regPassword !== regConfirmPassword)}
                className="w-full mt-2 py-2.5 bg-[#8C1B2E] hover:bg-[#721525] active:bg-[#5a111e] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Login Switcher Link */}
            <div className="mt-6 pt-5 border-t border-[#E5E2D9] dark:border-zinc-800/80 text-center text-xs text-stone-500 dark:text-zinc-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-[#8C1B2E] dark:text-red-400 hover:text-[#721525] dark:hover:text-red-300 font-semibold transition-colors"
              >
                Login
              </button>
            </div>
          </div>
        )}

        {screenMode === 'pending_approval' && (
          <div className="space-y-5 py-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold font-serif text-stone-900 dark:text-zinc-100">Waiting for Admin Approval</h2>
              <p className="mx-auto max-w-sm text-xs leading-relaxed text-stone-600 dark:text-zinc-400">The account request for <span className="font-semibold">{pendingApprovalEmail}</span> is awaiting review. You can sign in after an Admin approves it.</p>
            </div>
            <button type="button" onClick={() => { setLoginEmail(pendingApprovalEmail); setScreenMode('login'); }} className="w-full rounded-lg bg-[#8C1B2E] py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#721525]">
              Return to sign in
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: FORGOT PASSWORD (STEP 1: EMAIL ENTRY)           */}
        {/* ======================================================== */}
        {screenMode === 'forgot_password' && (
          <div className="space-y-5">
            <div className="text-center space-y-1.5">
              <h2 className="text-base font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
                Forgot your password?
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                Enter your email address and we'll send you a verification code.
              </p>
            </div>

            <form onSubmit={handleForgotPasswordSubmit} autoComplete="off" className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="forgot-email" className="text-xs font-medium text-stone-700 dark:text-zinc-300 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-stone-400 dark:text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 focus:border-[#8C1B2E] focus:ring-1 focus:ring-[#8C1B2E] rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-900 dark:text-zinc-100 outline-none transition-all disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-[#8C1B2E] hover:bg-[#721525] active:bg-[#5a111e] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending instructions...</span>
                  </>
                ) : (
                  <span>Send password reset email</span>
                )}
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Login</span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3B: FORGOT PASSWORD SUCCESS                         */}
        {/* ======================================================== */}
        {screenMode === 'forgot_success' && (
          <div className="space-y-5 text-center py-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
                Check your email
              </h2>
              <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                {successMessage || "If an account exists for this email, we've sent password-reset instructions."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full py-2.5 bg-[#8C1B2E] hover:bg-[#721525] active:bg-[#5a111e] text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to sign in</span>
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 4: RESET PASSWORD (STEP 3: NEW PASSWORD)           */}
        {/* ======================================================== */}
        {screenMode === 'reset_password' && (
          <div className="space-y-5">
            <div className="text-center space-y-1.5">
              <h2 className="text-base font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
                Create a new password
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                Choose a strong new password for your account.
              </p>
            </div>

            <form onSubmit={handleResetPasswordSubmit} autoComplete="off" className="space-y-4">
              {/* New Password */}
              <div className="space-y-1.5">
                <label htmlFor="new-pwd" className="text-xs font-medium text-stone-700 dark:text-zinc-300 block">
                  New password
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-stone-400 dark:text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    id="new-pwd"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 focus:border-[#8C1B2E] focus:ring-1 focus:ring-[#8C1B2E] rounded-xl pl-10 pr-10 py-2.5 text-xs text-stone-900 dark:text-zinc-100 outline-none transition-all disabled:opacity-50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-2.5 text-stone-400 hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors p-0.5"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showNewPassword}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label htmlFor="confirm-new-pwd" className="text-xs font-medium text-stone-700 dark:text-zinc-300 block">
                  Confirm new password
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-stone-400 dark:text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    id="confirm-new-pwd"
                    type={showConfirmNewPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="w-full bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 focus:border-[#8C1B2E] focus:ring-1 focus:ring-[#8C1B2E] rounded-xl pl-10 pr-10 py-2.5 text-xs text-stone-900 dark:text-zinc-100 outline-none transition-all disabled:opacity-50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    className="absolute right-3.5 top-2.5 text-stone-400 hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors p-0.5"
                    aria-label={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showConfirmNewPassword}
                  >
                    {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Live Password Strength Indicator for Reset */}
              {newPassword && (
                <div className="pt-1 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-500 dark:text-zinc-400">Strength:</span>
                    <span
                      className={`font-semibold capitalize ${
                        resetPasswordPolicy.strength === 'strong'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : resetPasswordPolicy.strength === 'fair'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {resetPasswordPolicy.strength}
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden flex gap-1">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        resetPasswordPolicy.strength === 'strong'
                          ? 'bg-emerald-500 w-full'
                          : resetPasswordPolicy.strength === 'fair'
                          ? 'bg-amber-500 w-2/3'
                          : 'bg-rose-500 w-1/3'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Password Requirements Checklist */}
              <div className="p-3 bg-[#F4F2EC] dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-1.5 text-[11px]">
                <span className="text-[10px] font-mono text-stone-500 dark:text-zinc-400 uppercase tracking-wider font-semibold block mb-1">
                  Password Requirements:
                </span>
                <div className="space-y-1">
                  <div className={`flex items-center gap-1.5 ${resetPasswordPolicy.length ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-stone-500 dark:text-zinc-400'}`}>
                    {resetPasswordPolicy.length ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <div className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-zinc-600 ml-1 mr-0.5 shrink-0" />}
                    <span>At least 12 characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${resetPasswordPolicy.uppercase ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-stone-500 dark:text-zinc-400'}`}>
                    {resetPasswordPolicy.uppercase ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <div className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-zinc-600 ml-1 mr-0.5 shrink-0" />}
                    <span>One uppercase letter (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${resetPasswordPolicy.lowercase ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-stone-500 dark:text-zinc-400'}`}>
                    {resetPasswordPolicy.lowercase ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <div className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-zinc-600 ml-1 mr-0.5 shrink-0" />}
                    <span>One lowercase letter (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${resetPasswordPolicy.number ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-stone-500 dark:text-zinc-400'}`}>
                    {resetPasswordPolicy.number ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <div className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-zinc-600 ml-1 mr-0.5 shrink-0" />}
                    <span>One number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${resetPasswordPolicy.special ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-stone-500 dark:text-zinc-400'}`}>
                    {resetPasswordPolicy.special ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <div className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-zinc-600 ml-1 mr-0.5 shrink-0" />}
                    <span>One special character (!@#$%^&*)</span>
                  </div>
                </div>
              </div>

              {/* Reset Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !resetPasswordPolicy.isValid || (newPassword !== confirmNewPassword)}
                className="w-full py-2.5 bg-[#8C1B2E] hover:bg-[#721525] active:bg-[#5a111e] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <span>Reset password</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 5: RESET SUCCESS                                    */}
        {/* ======================================================== */}
        {screenMode === 'reset_success' && (
          <div className="space-y-5 text-center py-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
                Password updated successfully.
              </h2>
              <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                Your password has been successfully updated. You may now return to sign in with your new credentials.
              </p>
            </div>

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full py-2.5 bg-[#8C1B2E] hover:bg-[#721525] active:bg-[#5a111e] text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to sign in</span>
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 6: RECOVERY INVALID / EXPIRED LINK                  */}
        {/* ======================================================== */}
        {screenMode === 'recovery_invalid' && (
          <div className="space-y-5 text-center py-2">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
                Link expired or invalid
              </h2>
              <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                Your password reset link is invalid or has expired. Please request a new reset email.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setScreenMode('forgot_password');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="w-full py-2.5 bg-[#8C1B2E] hover:bg-[#721525] active:bg-[#5a111e] text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <span>Request a new reset email</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Login</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Production Footer Note */}
      <div className="mt-6 text-center text-xs text-stone-500 dark:text-zinc-500">
        Thapar Institute of Engineering & Technology · Academic Timetable Portal
      </div>

      {/* Demo Information Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto text-stone-900 dark:text-zinc-100">
            <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold font-serif text-stone-900 dark:text-zinc-100">Presentation Accounts</h3>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">Pre-seeded accounts for independent review</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-[#E5E2D9] dark:border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-900 dark:text-zinc-200">Head of Department (HOD)</span>
                    <span className="text-[10px] font-mono text-stone-500 dark:text-zinc-400">coordinator.demo@demo.thapar.local</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">Full academic scheduling, constraint solvers, conflict diagnosis & master publish.</p>
                </div>

                <div className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-[#E5E2D9] dark:border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-900 dark:text-zinc-200">Faculty</span>
                    <span className="text-[10px] font-mono text-stone-500 dark:text-zinc-400">faculty.demo@demo.thapar.local</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">Faculty personal routine, class cancellation, substitute cover & availability.</p>
                </div>

                <div className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-[#E5E2D9] dark:border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-900 dark:text-zinc-200">Student</span>
                    <span className="text-[10px] font-mono text-stone-500 dark:text-zinc-400">student.demo@demo.thapar.local</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">Weekly student schedule, room numbers, faculty info & syllabus tracking.</p>
                </div>

                <div className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-[#E5E2D9] dark:border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-900 dark:text-zinc-200">College Admin / Dean</span>
                    <span className="text-[10px] font-mono text-stone-500 dark:text-zinc-400">admin.demo@demo.thapar.local</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">UGC academic calendar, regulatory workload limits & master publication approval.</p>
                </div>

                <div className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-[#E5E2D9] dark:border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-900 dark:text-zinc-200">Head of Department (HOD)</span>
                    <span className="text-[10px] font-mono text-stone-500 dark:text-zinc-400">hod.demo@demo.thapar.local</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">Department load balance, elective allocation & syllabus progress oversight.</p>
                </div>
              </div>

              <div className="text-[11px] text-stone-500 dark:text-zinc-500 leading-relaxed border-t border-[#E5E2D9] dark:border-zinc-800/60 pt-2.5">
                🔒 Security Note: Presentation accounts use the application's server-authoritative role permissions. Changes can be reverted from the Presentation controls menu.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDemoModal(false)}
              className="w-full py-2 bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 dark:hover:bg-zinc-700 text-stone-800 dark:text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Close Directory
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

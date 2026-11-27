import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export function VerifyEmailView({ onBackToLogin }: { onBackToLogin: () => void }) {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    let token = params.get('token');
    if (!token && hash.includes('token=')) {
      const match = hash.match(/token=([^&]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      setStatus('error');
      setMessage('Missing verification token in URL.');
      return;
    }

    api<{ success: boolean; message?: string }>('/api/auth/verify-email', {
      body: { token },
    })
      .then((data) => {
        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.message || 'Verification failed. The token may be invalid or expired.');
        }
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err?.message || 'Network error during verification.');
      });
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-xl p-8 text-center">
        {status === 'verifying' && (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-12 h-12 text-[#8C1B2E] animate-spin" />
            <h2 className="text-xl font-bold text-stone-900 dark:text-white">Verifying Email</h2>
            <p className="text-sm text-stone-600 dark:text-zinc-400">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-white">Email Verified!</h2>
            <p className="text-sm text-stone-600 dark:text-zinc-400">{message}</p>
            <button
              onClick={onBackToLogin}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#8C1B2E] hover:bg-[#731625] text-white font-medium rounded-xl transition-all shadow-md"
            >
              Sign In Now <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-white">Verification Failed</h2>
            <p className="text-sm text-stone-600 dark:text-zinc-400">{message}</p>
            <button
              onClick={onBackToLogin}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-800 hover:bg-stone-900 text-white font-medium rounded-xl transition-all shadow-md"
            >
              Return to Login <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

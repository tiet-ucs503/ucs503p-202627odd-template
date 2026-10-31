'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { dashboardPath, useAuth } from '@/features/auth/auth-context';
import { GuestOnly } from '@/features/auth/guards';
import { useLocale } from '@/features/i18n/locale-context';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';

const DEMO_PASSWORD = 'Demo@AgriConnect1';
const DEMO_FARMER = 'kabir.manchanda@demo.agriconnect.local';
const DEMO_BUYER = 'aman.singh@demo.agriconnect.local';

function LoginForm() {
  const { login } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const pendingRef = useRef(false);

  function fillDemo(nextEmail: string) {
    setError('');
    setEmail(nextEmail);
    setPassword(DEMO_PASSWORD);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setError('');
    setPending(true);

    try {
      // Trim — copy/paste from the demo box often adds a trailing space/newline.
      const user = await login(email.trim(), password.trim());
      router.replace(dashboardPath(user.role));
    } catch (cause) {
      setError(getErrorMessage(cause, t('login.fail')));
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl py-6 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
        {/* Brand Showcase Panel */}
        <div className="relative overflow-hidden rounded-3xl border border-forest/15 bg-gradient-to-br from-forest via-[#133d26] to-[#0a2416] p-8 text-paper shadow-[0_20px_50px_rgba(12,45,28,0.18)] lg:col-span-5">
          <div
            className="pointer-events-none absolute -end-20 -top-20 h-64 w-64 rounded-full bg-harvest/15 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -start-20 -bottom-20 h-64 w-64 rounded-full bg-leaf/20 blur-2xl"
            aria-hidden="true"
          />

          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-harvest/35 bg-harvest/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-harvest">
              <span className="h-1.5 w-1.5 rounded-full bg-harvest animate-pulse" aria-hidden="true" />
              <span>{t('home.eyebrow')}</span>
            </div>

            <div>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-paper sm:text-4xl">
                {t('home.title')}
              </h2>
              <p className="mt-3 text-sm text-paper/85 leading-relaxed sm:text-base">
                {t('home.subtitle')}
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-paper/15 text-xs font-semibold text-paper/90">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-leaf/25 text-leaf font-bold">✓</span>
                <span>{t('listing.verifiedFarmer')}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-harvest/25 text-harvest font-bold">✓</span>
                <span>{t('order.payment.escrowProtected')}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-leaf/25 text-leaf font-bold">✓</span>
                <span>{t('kisan.title')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="lg:col-span-7">
          <Card className="rounded-3xl border border-forest/10 bg-paper p-6 shadow-[0_20px_50px_rgba(12,45,28,0.08)] sm:p-8">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
                {t('login.title')}
              </h1>
              <p className="mt-1.5 text-sm text-ink/75 sm:text-base">{t('login.subtitle')}</p>
            </div>

            <div className="mt-6 rounded-2xl border border-harvest/30 bg-harvest/10 p-4 text-sm text-ink/80 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="font-bold text-forest">{t('login.demoTitle')}</p>
                <span className="h-2 w-2 rounded-full bg-harvest animate-pulse" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xs">
                <span className="font-semibold text-soil">{t('login.farmer')}:</span>{' '}
                <code className="rounded bg-paper/80 px-1.5 py-0.5 text-xs text-forest">{DEMO_FARMER}</code>
              </p>
              <p className="mt-1 text-xs">
                <span className="font-semibold text-soil">{t('login.buyer')}:</span>{' '}
                <code className="rounded bg-paper/80 px-1.5 py-0.5 text-xs text-forest">{DEMO_BUYER}</code>
              </p>
              <p className="mt-1 text-xs">
                <span className="font-semibold text-soil">{t('login.password')}:</span>{' '}
                <code className="rounded bg-paper/80 px-1.5 py-0.5 text-xs text-forest">{DEMO_PASSWORD}</code>
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs px-3 py-1.5 font-bold shadow-xs hover:border-forest/40"
                  onClick={() => fillDemo(DEMO_FARMER)}
                >
                  {t('login.farmer')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs px-3 py-1.5 font-bold shadow-xs hover:border-forest/40"
                  onClick={() => fillDemo(DEMO_BUYER)}
                >
                  {t('login.buyer')}
                </Button>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              {error ? <Alert>{error}</Alert> : null}
              <Field label={t('login.email')}>
                <Input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label={t('login.password')}>
                <Input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Button
                type="submit"
                disabled={pending}
                className="w-full text-base font-bold py-3.5 shadow-md shadow-leaf/20 hover:shadow-lg transition-all"
              >
                {pending ? t('login.signingIn') : t('login.signIn')}
              </Button>
            </form>

            <div className="mt-5 flex flex-col gap-2 border-t border-forest/10 pt-4 text-center sm:text-left">
              <p className="text-sm">
                <Link href="/forgot-password" className="font-bold text-leaf hover:underline">
                  {t('login.forgot')}
                </Link>
              </p>
              <p className="text-sm text-ink/70">
                {t('login.newHere')}{' '}
                <Link href="/register" className="font-bold text-leaf hover:underline">
                  {t('login.createAccount')}
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <GuestOnly>
      <LoginForm />
    </GuestOnly>
  );
}

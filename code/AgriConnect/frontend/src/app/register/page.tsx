'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { dashboardPath, useAuth } from '@/features/auth/auth-context';
import { GuestOnly } from '@/features/auth/guards';
import { useLocale } from '@/features/i18n/locale-context';
import { Alert, Button, Card, Field, Input, Select } from '@/components/ui';
import { INDIAN_STATES } from '@/lib/constants';
import { getErrorMessage } from '@/lib/api/errors';

function RegisterForm() {
  const { register } = useAuth();
  const { t, locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get('role') === 'BUYER' ? 'BUYER' : 'FARMER';
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    setError('');
    setPending(true);
    try {
      const user = await register({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        name: String(form.get('name') ?? ''),
        role: String(form.get('role')) === 'BUYER' ? 'BUYER' : 'FARMER',
        phone: String(form.get('phone') ?? ''),
        state: String(form.get('state') ?? ''),
        district: String(form.get('district') ?? ''),
        village: String(form.get('village') || '') || undefined,
        languagePref: locale,
      });
      router.replace(dashboardPath(user.role));
    } catch (cause) {
      setError(getErrorMessage(cause, t('register.fail')));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl py-6 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Brand Showcase Panel */}
        <div className="relative overflow-hidden rounded-3xl border border-forest/15 bg-gradient-to-br from-forest via-[#133d26] to-[#0a2416] p-8 text-paper shadow-[0_20px_50px_rgba(12,45,28,0.18)] lg:col-span-5 lg:sticky lg:top-24">
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

            <div className="space-y-4 pt-4 border-t border-paper/15 text-sm text-paper/90">
              <div className="rounded-2xl border border-paper/15 bg-paper/10 p-4">
                <p className="font-bold text-harvest">{t('register.roleFarmer')}</p>
                <p className="mt-1 text-xs text-paper/75">{t('home.onMarketBody')}</p>
              </div>
              <div className="rounded-2xl border border-paper/15 bg-paper/10 p-4">
                <p className="font-bold text-leaf">{t('register.roleBuyer')}</p>
                <p className="mt-1 text-xs text-paper/75">{t('home.marketplaceBody')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Register Form Card */}
        <div className="lg:col-span-7">
          <Card className="rounded-3xl border border-forest/10 bg-paper p-6 shadow-[0_20px_50px_rgba(12,45,28,0.08)] sm:p-8">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
                {t('register.title')}
              </h1>
              <p className="mt-1.5 text-sm text-ink/75 sm:text-base">{t('register.subtitle')}</p>
            </div>

            <form className="mt-6 grid gap-4" action={onSubmit}>
              {error ? <Alert>{error}</Alert> : null}
              <Field label={t('register.roleLabel')}>
                <Select name="role" defaultValue={defaultRole}>
                  <option value="FARMER">{t('register.roleFarmer')}</option>
                  <option value="BUYER">{t('register.roleBuyer')}</option>
                </Select>
              </Field>
              <Field label={t('register.fullName')}>
                <Input name="name" required minLength={1} />
              </Field>
              <Field label={t('register.email')}>
                <Input name="email" type="email" required />
              </Field>
              <Field label={t('register.password')}>
                <Input name="password" type="password" required minLength={8} />
              </Field>
              <Field label={t('register.phone')}>
                <Input name="phone" type="tel" required minLength={1} maxLength={30} />
              </Field>
              <Field label={t('register.state')}>
                <Select name="state" defaultValue="" required>
                  <option value="">{t('register.selectState')}</option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('register.district')}>
                  <Input name="district" required minLength={1} maxLength={100} />
                </Field>
                <Field label={t('register.village')}>
                  <Input name="village" maxLength={100} />
                </Field>
              </div>
              <Button
                type="submit"
                disabled={pending}
                className="w-full text-base font-bold py-3.5 shadow-md shadow-leaf/20 hover:shadow-lg transition-all"
              >
                {pending ? t('register.submitting') : t('register.submit')}
              </Button>
            </form>

            <div className="mt-5 border-t border-forest/10 pt-4 text-center sm:text-left">
              <p className="text-sm text-ink/70">
                {t('register.already')}{' '}
                <Link href="/login" className="font-bold text-leaf hover:underline">
                  {t('register.logIn')}
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <GuestOnly>
      <RegisterForm />
    </GuestOnly>
  );
}

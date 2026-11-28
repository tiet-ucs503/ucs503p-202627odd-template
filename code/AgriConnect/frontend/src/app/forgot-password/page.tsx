'use client';

import { useState } from 'react';
import { forgotPassword } from '@/lib/api/auth';
import { getErrorMessage } from '@/lib/api/errors';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    setError('');
    setPending(true);
    try {
      const { data } = await forgotPassword(String(form.get('email') ?? ''));
      setMessage(data.message);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="font-display text-3xl text-forest">{t('password.forgotTitle')}</h1>
      <p className="mt-1 text-ink/70">{t('password.forgotSubtitle')}</p>
      <form className="mt-6 space-y-4" action={onSubmit}>
        {error ? <Alert>{error}</Alert> : null}
        {message ? <p className="rounded-xl bg-leaf/10 p-3 text-sm text-forest">{message}</p> : null}
        <Field label={t('password.email')}>
          <Input name="email" type="email" required />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t('password.sending') : t('password.send')}
        </Button>
      </form>
    </Card>
  );
}

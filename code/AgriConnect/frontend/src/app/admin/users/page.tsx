'use client';

import { useEffect, useState } from 'react';
import { RequireAuth } from '@/features/auth/guards';
import { Alert, Badge, Button, Card, Field, Input, Spinner } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { listAdminUsers, suspendUser, verifyUser } from '@/lib/api/admin';
import { getErrorMessage } from '@/lib/api/errors';
import type { AdminUser } from '@/lib/api/types';

function UsersAdmin() {
  const { t } = useLocale();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  function reload(search = query) {
    void listAdminUsers({ q: search || undefined, limit: 50 })
      .then((result) => setUsers(result.data))
      .catch((cause) => setError(getErrorMessage(cause)));
  }

  useEffect(() => {
    reload('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(user: AdminUser, kind: 'suspend' | 'verify') {
    setError('');
    try {
      if (kind === 'suspend') {
        await suspendUser(user.id, {
          isSuspended: !user.isSuspended,
          reason: user.isSuspended ? 'Reinstated by admin' : 'Suspended from admin desk',
        });
      } else {
        await verifyUser(user.id, !user.verified);
      }
      reload();
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  if (error && !users) return <Alert>{error}</Alert>;
  if (!users) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="border-b border-forest/10 pb-5">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
          {t('admin.users')}
        </h1>
      </div>

      <Card className="p-4 sm:p-5 shadow-xs border-forest/10">
        <form
          className="flex flex-wrap items-end gap-3"
          action={(form) => {
            const next = String(form.get('q') ?? '');
            setQuery(next);
            reload(next);
          }}
        >
          <div className="min-w-[240px] flex-1">
            <Field label={t('common.search')}>
              <Input name="q" placeholder={t('admin.searchPlaceholder')} defaultValue={query} />
            </Field>
          </div>
          <Button type="submit" className="shadow-xs">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
            <span>{t('common.search')}</span>
          </Button>
        </form>
      </Card>
      {error ? <Alert>{error}</Alert> : null}
      {users.map((user) => (
        <Card key={user.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl text-forest">{user.name}</p>
            <p className="text-sm text-ink/70">
              {user.email} · {user.role}
            </p>
            <div className="mt-2 flex gap-2">
              {user.verified ? (
                <Badge tone="good">{t('admin.verified')}</Badge>
              ) : (
                <Badge>{t('admin.unverified')}</Badge>
              )}
              {user.isSuspended ? <Badge tone="bad">{t('admin.suspended')}</Badge> : null}
            </div>
          </div>
          {user.role !== 'ADMIN' ? (
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => void act(user, 'verify')}>
                {user.verified ? t('admin.unverify') : t('admin.verify')}
              </Button>
              <Button
                variant={user.isSuspended ? 'secondary' : 'danger'}
                type="button"
                onClick={() => void act(user, 'suspend')}
              >
                {user.isSuspended ? t('admin.reinstate') : t('admin.suspend')}
              </Button>
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <RequireAuth roles={['ADMIN']}>
      <UsersAdmin />
    </RequireAuth>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { RequireAuth } from '@/features/auth/guards';
import { ListingCard } from '@/components/listing-card';
import { Alert, Button, Card, Field, Select, Spinner } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { listListings } from '@/lib/api/listings';
import { moderateListing } from '@/lib/api/admin';
import { getErrorMessage } from '@/lib/api/errors';
import type { Listing, ListingStatus } from '@/lib/api/types';

function AdminListings() {
  const { t } = useLocale();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<ListingStatus>('active');

  function reload(nextStatus = status) {
    void listListings({ status: nextStatus, limit: 50 })
      .then((result) => setListings(result.data))
      .catch((cause) => setError(getErrorMessage(cause)));
  }

  useEffect(() => {
    reload('active');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moderate(id: string, next: 'removed' | 'active') {
    setError('');
    try {
      await moderateListing(id, {
        status: next,
        reason: next === 'removed' ? 'Removed by admin' : 'Reinstated by admin',
      });
      reload();
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  if (error && !listings) return <Alert>{error}</Alert>;
  if (!listings) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="border-b border-forest/10 pb-5">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
          {t('admin.moderationTitle')}
        </h1>
      </div>

      <Card className="p-4 sm:p-5 shadow-xs border-forest/10">
        <form
          className="flex flex-wrap items-end gap-3"
          action={(form) => {
            const next = String(form.get('status')) as ListingStatus;
            setStatus(next);
            reload(next);
          }}
        >
          <div className="min-w-[200px]">
            <Field label={t('common.status')}>
              <Select name="status" defaultValue={status}>
                <option value="active">{t('listing.status.active')}</option>
                <option value="draft">{t('listing.status.draft')}</option>
                <option value="sold_out">{t('listing.status.sold_out')}</option>
                <option value="expired">{t('listing.status.expired')}</option>
                <option value="removed">{t('listing.status.removed')}</option>
              </Select>
            </Field>
          </div>
          <Button type="submit" className="shadow-xs">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
              <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clipRule="evenodd" />
            </svg>
            <span>{t('common.filter')}</span>
          </Button>
        </form>
      </Card>
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {listings.map((listing) => (
          <div key={listing.id} className="space-y-2">
            <ListingCard listing={listing} />
            <div className="flex gap-2">
              <Button type="button" variant="danger" onClick={() => void moderate(listing.id, 'removed')}>
                {t('common.remove')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void moderate(listing.id, 'active')}>
                {t('admin.reinstate')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminListingsPage() {
  return (
    <RequireAuth roles={['ADMIN']}>
      <AdminListings />
    </RequireAuth>
  );
}

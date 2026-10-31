'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/features/auth/guards';
import { ListingForm } from '@/features/listings/listing-form';
import { useLocale } from '@/features/i18n/locale-context';
import { Alert, Spinner } from '@/components/ui';
import { getListing } from '@/lib/api/listings';
import { getErrorMessage } from '@/lib/api/errors';
import type { Listing } from '@/lib/api/types';

function EditListing() {
  const params = useParams<{ id: string }>();
  const { t } = useLocale();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void getListing(params.id)
      .then((result) => setListing(result.data))
      .catch((cause) => setError(getErrorMessage(cause)));
  }, [params.id]);

  if (error) return <Alert>{error}</Alert>;
  if (!listing) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl text-forest">
        {t('listing.editTitle', { crop: listing.crop })}
      </h1>
      <ListingForm listing={listing} />
    </div>
  );
}

export default function EditListingPage() {
  return (
    <RequireAuth roles={['FARMER']}>
      <EditListing />
    </RequireAuth>
  );
}

'use client';

import { RequireAuth } from '@/features/auth/guards';
import { ListingForm } from '@/features/listings/listing-form';
import { useLocale } from '@/features/i18n/locale-context';

export default function NewListingPage() {
  const { t } = useLocale();

  return (
    <RequireAuth roles={['FARMER']}>
      <div className="space-y-4">
        <h1 className="font-display text-4xl text-forest">{t('listing.addTitle')}</h1>
        <ListingForm />
      </div>
    </RequireAuth>
  );
}

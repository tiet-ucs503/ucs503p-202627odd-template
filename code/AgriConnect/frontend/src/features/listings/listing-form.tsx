'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { createListing, updateListing, uploadListingPhotos } from '@/lib/api/listings';
import { getErrorMessage } from '@/lib/api/errors';
import { CROP_CATEGORIES, INDIAN_STATES, UNITS } from '@/lib/constants';
import type { Listing } from '@/lib/api/types';

export function ListingForm({ listing }: { listing?: Listing }) {
  const router = useRouter();
  const { t } = useLocale();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    setError('');
    setPending(true);
    try {
      const basePayload = {
        crop: String(form.get('crop') ?? ''),
        category: String(form.get('category') ?? ''),
        variety: String(form.get('variety') || '') || null,
        quantity: String(form.get('quantity') ?? ''),
        unit: String(form.get('unit') ?? 'kg') as 'kg' | 'quintal' | 'ton',
        pricePerUnit: String(form.get('pricePerUnit') ?? ''),
        harvestDate: String(form.get('harvestDate') ?? ''),
        state: String(form.get('state') ?? ''),
        district: String(form.get('district') ?? ''),
        village: String(form.get('village') || '') || null,
        description: String(form.get('description') || '') || null,
        minimumOrderQuantity: String(form.get('minimumOrderQuantity') ?? ''),
        perishable: form.get('perishable') === 'on',
      };

      const publishNow = form.get('publish') === 'on';
      const payload =
        listing
          ? {
              ...basePayload,
              status: publishNow ? ('active' as const) : listing.status,
            }
          : {
              ...basePayload,
              status: 'draft' as const,
            };

      const saved = listing
        ? await updateListing(listing.id, {
            ...payload,
            status:
              publishNow
                ? 'active'
                : listing.status === 'active' || listing.status === 'draft'
                  ? listing.status
                  : undefined,
          })
        : await createListing({ ...payload, status: 'draft' });

      const files = Array.from((form.getAll('files') as File[]).filter((file) => file.size > 0));
      if (files.length > 0) {
        await uploadListingPhotos(saved.data.id, files.slice(0, 5));
      }

      if (!listing && publishNow) {
        await updateListing(saved.data.id, { status: 'active' });
      }

      router.push('/farmer/listings');
    } catch (cause) {
      setError(getErrorMessage(cause, t('listing.form.fail')));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <form className="grid gap-4 md:grid-cols-2" action={onSubmit}>
        {error ? (
          <div className="md:col-span-2">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <Field label={t('listing.form.crop')}>
          <Input name="crop" required defaultValue={listing?.crop} />
        </Field>
        <Field label={t('listing.form.category')}>
          <Select name="category" defaultValue={listing?.category ?? 'grains'}>
            {CROP_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`listing.category.${category}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('listing.form.variety')}>
          <Input name="variety" defaultValue={listing?.variety ?? ''} />
        </Field>
        <Field label={t('listing.form.harvestDate')}>
          <Input name="harvestDate" type="date" required defaultValue={listing?.harvestDate?.slice(0, 10)} />
        </Field>
        <Field label={t('listing.form.quantity')}>
          <Input name="quantity" required defaultValue={listing?.quantity} />
        </Field>
        <Field label={t('listing.form.unit')}>
          <Select name="unit" defaultValue={listing?.unit ?? 'kg'}>
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {t(`units.${unit}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('listing.form.pricePerUnit')}>
          <Input name="pricePerUnit" required defaultValue={listing?.pricePerUnit} />
        </Field>
        <Field label={t('listing.form.minimumOrderQuantity')}>
          <Input name="minimumOrderQuantity" required defaultValue={listing?.minimumOrderQuantity} />
        </Field>
        <Field label={t('listing.form.state')}>
          <Select name="state" required defaultValue={listing?.state ?? 'Punjab'}>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('listing.form.district')}>
          <Input name="district" required defaultValue={listing?.district} />
        </Field>
        <Field label={t('listing.form.village')}>
          <Input name="village" defaultValue={listing?.village ?? ''} />
        </Field>
        <label className="flex items-center gap-3 pt-8 text-base font-semibold text-forest">
          <input type="checkbox" name="perishable" defaultChecked={listing?.perishable} className="h-5 w-5" />
          {t('listing.form.perishable')}
        </label>
        <div className="md:col-span-2">
          <Field label={t('listing.form.description')}>
            <Textarea name="description" defaultValue={listing?.description ?? ''} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t('listing.form.photos')}>
            <Input name="files" type="file" accept="image/jpeg,image/png,image/webp" multiple />
          </Field>
        </div>
        <label className="flex items-center gap-3 text-base font-semibold text-forest md:col-span-2">
          <input
            type="checkbox"
            name="publish"
            className="h-5 w-5"
            defaultChecked={listing?.status === 'active'}
          />
          {listing ? t('listing.form.keepPublished') : t('listing.form.publishNow')}
        </label>
        <div className="md:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending
              ? t('listing.form.saving')
              : listing
                ? t('listing.form.save')
                : t('listing.form.create')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

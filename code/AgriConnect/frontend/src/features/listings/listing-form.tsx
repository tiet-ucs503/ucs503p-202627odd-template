'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import { createListing, updateListing, uploadListingPhotos } from '@/lib/api/listings';
import { getErrorMessage } from '@/lib/api/errors';
import { CROP_CATEGORIES, INDIAN_STATES, UNITS } from '@/lib/constants';
import { matchCropCategory } from '@/lib/crop-categories';
import type { Listing } from '@/lib/api/types';

export function ListingForm({ listing }: { listing?: Listing }) {
  const router = useRouter();
  const { t } = useLocale();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [crop, setCrop] = useState(listing?.crop ?? '');
  const [category, setCategory] = useState(listing?.category ?? 'grains');
  const [variety, setVariety] = useState(listing?.variety ?? '');
  const [harvestDate, setHarvestDate] = useState(listing?.harvestDate?.slice(0, 10) ?? '');
  const [quantity, setQuantity] = useState(listing?.quantity ?? '');
  const [unit, setUnit] = useState<'kg' | 'quintal' | 'ton'>(listing?.unit ?? 'kg');
  const [pricePerUnit, setPricePerUnit] = useState(listing?.pricePerUnit ?? '');
  const [minimumOrderQuantity, setMinimumOrderQuantity] = useState(
    listing?.minimumOrderQuantity ?? '',
  );
  const [state, setState] = useState(listing?.state ?? 'Punjab');
  const [district, setDistrict] = useState(listing?.district ?? '');
  const [village, setVillage] = useState(listing?.village ?? '');
  const [perishable, setPerishable] = useState(listing?.perishable ?? false);
  const [description, setDescription] = useState(listing?.description ?? '');
  const [publish, setPublish] = useState(listing?.status === 'active');
  const [files, setFiles] = useState<File[]>([]);

  const onCropChange = (value: string) => {
    setCrop(value);
    const guessed = matchCropCategory(value);
    if (guessed) {
      setCategory(guessed);
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const basePayload = {
        crop: crop.trim(),
        category: category.trim(),
        variety: variety.trim() || null,
        quantity: quantity.trim(),
        unit,
        pricePerUnit: pricePerUnit.trim(),
        harvestDate: harvestDate.trim(),
        state: state.trim(),
        district: district.trim(),
        village: village.trim() || null,
        description: description.trim() || null,
        minimumOrderQuantity: minimumOrderQuantity.trim(),
        perishable,
      };

      const payload = listing
        ? {
            ...basePayload,
            status: publish ? ('active' as const) : listing.status,
          }
        : {
            ...basePayload,
            status: 'draft' as const,
          };

      const saved = listing
        ? await updateListing(listing.id, {
            ...payload,
            status:
              publish
                ? 'active'
                : listing.status === 'active' || listing.status === 'draft'
                  ? listing.status
                  : undefined,
          })
        : await createListing({ ...payload, status: 'draft' });

      if (files.length > 0) {
        await uploadListingPhotos(saved.data.id, files.slice(0, 5));
      }

      if (!listing && publish) {
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
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        {error ? (
          <div className="md:col-span-2">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <Field label={t('listing.form.crop')}>
          <Input
            name="crop"
            required
            value={crop}
            onChange={(e) => onCropChange(e.target.value)}
          />
        </Field>
        <Field label={t('listing.form.category')}>
          <Select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CROP_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {t(`listing.category.${cat}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('listing.form.variety')}>
          <Input
            name="variety"
            value={variety}
            onChange={(e) => setVariety(e.target.value)}
          />
        </Field>
        <Field label={t('listing.form.harvestDate')}>
          <Input
            name="harvestDate"
            type="date"
            required
            value={harvestDate}
            onChange={(e) => setHarvestDate(e.target.value)}
          />
        </Field>
        <Field label={t('listing.form.quantity')}>
          <Input
            name="quantity"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label={t('listing.form.unit')}>
          <Select
            name="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as 'kg' | 'quintal' | 'ton')}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`units.${u}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('listing.form.pricePerUnit')}>
          <Input
            name="pricePerUnit"
            required
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(e.target.value)}
          />
        </Field>
        <Field label={t('listing.form.minimumOrderQuantity')}>
          <Input
            name="minimumOrderQuantity"
            required
            value={minimumOrderQuantity}
            onChange={(e) => setMinimumOrderQuantity(e.target.value)}
          />
        </Field>
        <Field label={t('listing.form.state')}>
          <Select
            name="state"
            required
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('listing.form.district')}>
          <Input
            name="district"
            required
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          />
        </Field>
        <Field label={t('listing.form.village')}>
          <Input
            name="village"
            value={village}
            onChange={(e) => setVillage(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-3 pt-8 text-base font-semibold text-forest">
          <input
            type="checkbox"
            name="perishable"
            checked={perishable}
            onChange={(e) => setPerishable(e.target.checked)}
            className="h-5 w-5"
          />
          {t('listing.form.perishable')}
        </label>
        <div className="md:col-span-2">
          <Field label={t('listing.form.description')}>
            <Textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t('listing.form.photos')}>
            <Input
              name="files"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <p className="mt-1.5 text-xs text-ink/65">
              {t('listing.form.photosHint', { crop: crop || t('common.cropExample') })}
            </p>
            {files.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {files.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center gap-2 rounded-lg border border-forest/20 bg-paper/80 px-2.5 py-1 text-xs font-semibold text-forest shadow-xs"
                  >
                    <span className="max-w-[160px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== idx))}
                      className="font-bold text-ember hover:opacity-80"
                      aria-label={t('common.remove')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </Field>
        </div>
        <label className="flex items-center gap-3 text-base font-semibold text-forest md:col-span-2">
          <input
            type="checkbox"
            name="publish"
            className="h-5 w-5"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
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

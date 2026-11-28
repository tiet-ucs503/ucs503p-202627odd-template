'use client';

import { useEffect, useState } from 'react';
import { cx } from '@/components/ui';

const LOCAL_CROP_PHOTOS: Record<string, string> = {
  onion: '/crops/onion.jpg',
  tomato: '/crops/tomato.jpg',
  wheat: '/crops/wheat.jpg',
  rice: '/crops/rice.jpg',
};

/** Reliable CDN art when local public files are unavailable. */
const CDN_CROP_PHOTOS: Record<string, string> = {
  onion:
    'https://images.unsplash.com/photo-1508747703725-719777637510?w=1200&auto=format&fit=crop&q=80',
  tomato:
    'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200&auto=format&fit=crop&q=80',
  wheat:
    'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=1200&auto=format&fit=crop&q=80',
  rice:
    'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1200&auto=format&fit=crop&q=80',
};

const DEFAULT_LOCAL = '/crops/wheat.jpg';
const DEFAULT_CDN = CDN_CROP_PHOTOS.wheat;

/** Tiny / corrupt uploads (common after smoke tests) often still HTTP 200. */
const MIN_VALID_PX = 48;

function matchCropKey(crop: string): keyof typeof LOCAL_CROP_PHOTOS | null {
  const normalized = crop.trim().toLowerCase();
  if (normalized in LOCAL_CROP_PHOTOS) {
    return normalized as keyof typeof LOCAL_CROP_PHOTOS;
  }
  for (const key of Object.keys(LOCAL_CROP_PHOTOS) as (keyof typeof LOCAL_CROP_PHOTOS)[]) {
    if (normalized.includes(key)) return key;
  }
  return null;
}

export function cropPhotoFallback(crop: string): string {
  const key = matchCropKey(crop);
  return key ? LOCAL_CROP_PHOTOS[key] : DEFAULT_LOCAL;
}

function cropCdnFallback(crop: string): string {
  const key = matchCropKey(crop);
  return key ? CDN_CROP_PHOTOS[key] : DEFAULT_CDN;
}

export function ListingPhoto({
  crop,
  src,
  className,
}: {
  crop: string;
  src?: string;
  className?: string;
}) {
  const local = cropPhotoFallback(crop);
  const cdn = cropCdnFallback(crop);
  const [source, setSource] = useState<string>(src || local);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSource(src || local);
  }, [src, local]);

  function advanceFallback(current: string): string {
    if (src && current === src) return local;
    if (current === local && local !== cdn) return cdn;
    return current;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={source}
      alt={crop}
      referrerPolicy="no-referrer"
      className={cx('h-full w-full object-cover', className)}
      onError={() => {
        setSource((current) => advanceFallback(current));
      }}
      onLoad={(event) => {
        const img = event.currentTarget;
        if (img.naturalWidth > 0 && img.naturalWidth < MIN_VALID_PX) {
          setSource((current) => advanceFallback(current));
        }
      }}
    />
  );
}

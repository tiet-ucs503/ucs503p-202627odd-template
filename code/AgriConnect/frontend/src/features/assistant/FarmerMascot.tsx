'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cx } from '@/components/ui';

export function FarmerMascot({
  className,
  size = 88,
  title = 'Kisan, AgriConnect farm helper',
}: {
  className?: string;
  size?: number;
  title?: string;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <span
      className={cx(
        'relative inline-flex shrink-0 overflow-hidden rounded-full bg-leaf shadow-[inset_0_0_0_1px_rgba(31,61,43,0.18)]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {imgError ? (
        <span
          className="flex h-full w-full items-center justify-center font-display font-bold text-paper"
          style={{ fontSize: Math.max(14, size * 0.38) }}
          aria-hidden
        >
          K
        </span>
      ) : (
        <Image
          src="/kisan-mascot.png"
          alt={title}
          width={size}
          height={size}
          onError={() => setImgError(true)}
          className="h-full w-full object-cover object-[center_18%]"
        />
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-harvest/35"
      />
    </span>
  );
}

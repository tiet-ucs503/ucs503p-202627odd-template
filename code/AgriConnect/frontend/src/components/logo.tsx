'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cx } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';

const LOGO_WIDTH = 1536;
const LOGO_HEIGHT = 1024;

type LogoProps = {
  /** header: readable wordmark. hero: full illustrated lockup. */
  variant?: 'header' | 'hero';
  className?: string;
  linked?: boolean;
};

function HeaderWordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        viewBox="0 0 40 40"
        className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"
        aria-hidden
      >
        <rect width="40" height="40" rx="10" fill="#3d7a4a" />
        <ellipse cx="13.5" cy="18" rx="7" ry="5.2" transform="rotate(-38 13.5 18)" fill="#fffcf5" />
        <ellipse cx="26.5" cy="18" rx="7" ry="5.2" transform="rotate(38 26.5 18)" fill="#fffcf5" />
        <rect x="18.35" y="17" width="3.3" height="14.5" rx="1.6" fill="#d4a017" />
      </svg>
      <span className="font-display text-[1.35rem] leading-none tracking-tight text-paper sm:text-[1.55rem]">
        AgriConnect
      </span>
    </span>
  );
}

export function Logo({ variant = 'header', className, linked = true }: LogoProps) {
  const { t } = useLocale();
  const image =
    variant === 'header' ? (
      <HeaderWordmark />
    ) : (
      <Image
        src="/logo.png"
        alt={t('brand.logoAlt')}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority
        sizes="(max-width: 640px) 280px, (max-width: 768px) 380px, 500px"
        className={cx(
          'h-auto w-full max-w-[280px] object-contain object-left drop-shadow-sm sm:max-w-[380px] md:max-w-[500px]',
          className,
        )}
      />
    );

  if (!linked) {
    return variant === 'header' ? (
      <span className={className}>{image}</span>
    ) : (
      image
    );
  }

  return (
    <Link
      href="/"
      className={cx('inline-flex shrink-0 items-center', className)}
      aria-label={t('brand.homeLabel')}
    >
      {image}
    </Link>
  );
}

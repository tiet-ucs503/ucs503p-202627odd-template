'use client';

import dynamic from 'next/dynamic';
import { HeroFarmFallback } from '@/features/hero/hero-farm-fallback';
import { canUseWebGL, useIsClient, usePrefersReducedMotion } from '@/features/hero/use-prefers-reduced-motion';

const HeroCanvas = dynamic(
  () => import('@/features/hero/scene/HeroCanvas').then((mod) => mod.HeroCanvas),
  { ssr: false, loading: () => <HeroFarmFallback /> },
);

export function HeroFarmStage() {
  const reducedMotion = usePrefersReducedMotion();
  const isClient = useIsClient();

  if (!isClient || reducedMotion || !canUseWebGL()) {
    return <HeroFarmFallback />;
  }

  return <HeroCanvas />;
}

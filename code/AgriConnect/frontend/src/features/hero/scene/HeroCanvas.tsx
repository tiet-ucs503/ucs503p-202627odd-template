'use client';

import { HeroFarmFallback } from '@/features/hero/hero-farm-fallback';

/**
 * WebGL farm scene is not shipped yet. Export a stable module so
 * `hero-farm-stage` dynamic import typechecks and builds in production.
 */
export function HeroCanvas() {
  return <HeroFarmFallback />;
}

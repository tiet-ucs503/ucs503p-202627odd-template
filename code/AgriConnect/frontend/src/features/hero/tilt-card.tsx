'use client';

import { useRef, type PointerEvent, type ReactNode } from 'react';
import { cx } from '@/components/ui';
import { usePrefersReducedMotion } from '@/features/hero/use-prefers-reduced-motion';

type TiltCardProps = {
  children: ReactNode;
  className?: string;
};

export function TiltCard({ children, className }: TiltCardProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  function onMove(event: PointerEvent<HTMLDivElement>) {
    if (reduced) return;
    const inner = innerRef.current;
    if (!inner) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const rotateX = (0.5 - y) * 9;
    const rotateY = (x - 0.5) * 11;
    inner.style.transform = `perspective(920px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
    inner.style.setProperty('--shine-x', `${x * 100}%`);
    inner.style.setProperty('--shine-y', `${y * 100}%`);
  }

  function onLeave() {
    const inner = innerRef.current;
    if (!inner) return;
    inner.style.transform = 'perspective(920px) rotateX(0deg) rotateY(0deg) translateZ(0)';
  }

  return (
    <div
      className={cx('tilt-outer h-full', className)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div ref={innerRef} className="tilt-inner h-full">
        <div className="tilt-shine" aria-hidden />
        {children}
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from 'react';

/**
 * CanvasSpotlight
 * High-performance cursor spotlight effect.
 * Follows mouse pointer via requestAnimationFrame without React state updates.
 * Disabled on touch/coarse devices.
 */
export default function CanvasSpotlight() {
  const spotlightRef = useRef(null);

  useEffect(() => {
    // Check if device is touch-primary
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let animationFrameId = null;

    const handlePointerMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const updatePosition = () => {
      // Smooth interpolation (lerp)
      currentX += (targetX - currentX) * 0.14;
      currentY += (targetY - currentY) * 0.14;

      if (spotlightRef.current) {
        spotlightRef.current.style.transform = `translate3d(${currentX - 360}px, ${currentY - 360}px, 0)`;
      }

      animationFrameId = requestAnimationFrame(updatePosition);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    animationFrameId = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="canvas-spotlight-overlay" aria-hidden="true">
      <div ref={spotlightRef} className="cursor-spotlight-disc" />
    </div>
  );
}

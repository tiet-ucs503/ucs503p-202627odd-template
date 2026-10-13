"use client";

import { useEffect } from "react";
import Lenis from "lenis";

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      lerp: 0.1,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    });
    window.__lenis = lenis;

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    function onAnchor(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      const a = t?.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute("href")?.slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -88, duration: 1.4 });
      history.pushState(null, "", `#${id}`);
    }
    document.addEventListener("click", onAnchor);

    function onResize() {
      lenis.resize();
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(document.documentElement);
    ro.observe(document.body);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("click", onAnchor);
      ro.disconnect();
      lenis.destroy();
      window.__lenis = undefined;
    };
  }, []);

  return null;
}

export function lenisStop() {
  if (typeof window !== "undefined" && window.__lenis) window.__lenis.stop();
}
export function lenisStart() {
  if (typeof window !== "undefined" && window.__lenis) window.__lenis.start();
}

"use client";

import { useEffect, useState } from "react";

/**
 * Distance (px) the virtual keyboard covers at the bottom of the layout viewport.
 * Uses Visual Viewport API so fixed bottom bars can sit above the keyboard
 * without "dancing" on iOS/Android.
 *
 * Returns 0 when keyboard is closed.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // How much of the layout viewport is covered below the visual viewport
        const covered = Math.max(
          0,
          Math.round(window.innerHeight - vv.height - vv.offsetTop),
        );
        // Ignore tiny jitter (< keyboard)
        setInset(covered > 48 ? covered : 0);
      });
    };

    measure();
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  return inset;
}

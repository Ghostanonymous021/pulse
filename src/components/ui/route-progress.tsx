"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin top progress bar for page navigation — Reddit/YouTube pattern.
 * Starts on internal link click, completes when the target route
 * finishes rendering (pathname/searchParams change). Only becomes
 * visible if navigation takes longer than ~300ms, to avoid flicker
 * on instant transitions.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigating = useRef(false);

  useEffect(() => {
    function clearTimers() {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (tickTimer.current) clearInterval(tickTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    }

    function start() {
      if (navigating.current) return;
      navigating.current = true;
      clearTimers();
      setProgress(0);
      showTimer.current = setTimeout(() => {
        if (!navigating.current) return;
        setVisible(true);
        tickTimer.current = setInterval(() => {
          setProgress((p) => (p < 88 ? p + (88 - p) * 0.12 : p));
        }, 120);
      }, 300);
    }

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      if (
        href.startsWith("http") &&
        !href.startsWith(window.location.origin)
      ) {
        return;
      }
      start();
    }

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      clearTimers();
    };
  }, []);

  // Route finished changing — complete and hide.
  useEffect(() => {
    if (!navigating.current) return;
    navigating.current = false;
    if (showTimer.current) clearTimeout(showTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    setProgress(100);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 200);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px] bg-transparent"
    >
      <div
        className="h-full bg-brand transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

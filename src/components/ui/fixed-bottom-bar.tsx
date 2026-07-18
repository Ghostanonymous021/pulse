"use client";

import type { ReactNode } from "react";

import { useKeyboardInset } from "@/lib/ui/use-keyboard-inset";
import { cn } from "@/lib/utils";

/**
 * Fixed bottom chrome that tracks the virtual keyboard via visualViewport.
 * Avoids the classic iOS jump of bottom:0 + safe-area when the keyboard opens.
 */
export function FixedBottomBar({
  children,
  className,
  innerClassName,
  zIndex = 30,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  zIndex?: number;
}) {
  const keyboard = useKeyboardInset();
  const keyboardOpen = keyboard > 0;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 border-t border-[var(--separator)] bg-[var(--elevated)] backdrop-blur-xl backdrop-saturate-150",
        className,
      )}
      style={{
        bottom: keyboard,
        zIndex,
        // When keyboard is open, drop home-indicator padding (already above keyboard)
        paddingBottom: keyboardOpen
          ? 8
          : "max(0.5rem, env(safe-area-inset-bottom))",
        // Promote layer — reduces paint thrash while keyboard animates
        transform: "translateZ(0)",
        willChange: keyboardOpen ? "bottom" : "auto",
      }}
    >
      <div className={cn("mx-auto w-full max-w-lg", innerClassName)}>
        {children}
      </div>
    </div>
  );
}

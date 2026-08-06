"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
} as const;

const EKG_PATH =
  "M3927.15 5942.17c12.36,0 14.61,-20.26 18.32,-31.24l60.96 -172.37c4.17,-12.09 7.67,-21.95 12.29,-34.33 4.02,-10.78 6,-25.61 15.1,-32.6 6.03,9.41 5.68,22.88 6.79,34.44l25.59 251.42c5.2,52.39 22.45,248.81 29,284.09 6.76,36.42 61.13,44.2 72.83,15.26 24.21,-59.86 128.29,-354.78 142.46,-364.85 17.32,18.24 10.93,50.19 30,50.19l166.67 0c24.35,0 40.45,-7.08 45.32,-27.34 23.59,-98.17 -129.27,-41.54 -156.98,-60.52 -10.82,-11.75 -39.67,-101.74 -49.24,-124.05 -9.75,-22.72 -43.52,-25.28 -59.39,-14.61 -18.42,12.38 -66.09,154.95 -76.07,180.68 -5.13,13.24 -36.81,114.22 -50.3,118.57 -4.5,-8.77 -47.8,-445.7 -55.56,-527.09 -2.61,-27.36 0.85,-45.78 -20.23,-59.4 -20.48,-13.23 -48.49,-13.55 -60.82,4.31 -10.59,15.33 -137.74,397.63 -152.49,423.54 -30.33,1.93 -125.55,-4.22 -145.16,5.37 -21.64,10.59 -38.05,80.54 27.59,80.54l173.33 0z";

/**
 * Brand "processing" indicator — traco de batimento (EKG) proprio, nao
 * um spinner generico nem o sonar de bolinha anterior.
 *
 * - Duas copias sobrepostas do mesmo traco: uma fixa e esbatida (para o
 *   icone nunca "desaparecer" por completo entre passagens), outra por
 *   cima com uma faixa de brilho que percorre o traco da esquerda para a
 *   direita em loop (mask-image + mask-position animados, sem JS nem
 *   libs de animacao).
 * - Debounced ~180ms: acoes rapidas (seguir otimista, queries em cache)
 *   nunca chegam a mostrar o loader — so trabalho realmente pendente.
 * - `tone="brand"` (default) pinta o traco azul da marca — usar em
 *   qualquer superficie neutra/escura (bg-muted, texto solto).
 * - `tone="on-brand"` usa `currentColor` do contexto — usar sobre uma
 *   superficie ja pintada com bg-brand (o texto do botao ja e
 *   text-brand-foreground), evitando azul sobre azul.
 * - `prefers-reduced-motion` e tratado globalmente em globals.css.
 */
export function PulseLoader({
  size = "sm",
  tone = "brand",
  className,
  label = "A processar",
}: {
  size?: keyof typeof SIZES;
  tone?: "brand" | "on-brand";
  className?: string;
  label?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 180);
    return () => clearTimeout(t);
  }, []);

  if (!visible) {
    // Reserve the box so surrounding layout doesn't shift once it appears.
    return <span className={cn(SIZES[size], className)} aria-hidden />;
  }

  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "pulse-loader inline-flex shrink-0",
        SIZES[size],
        tone === "brand" && "text-brand",
        className,
      )}
    >
      <svg viewBox="3687 5399 888 896" fill="none" className="h-full w-full" aria-hidden>
        <path d={EKG_PATH} fill="currentColor" opacity="0.28" />
        <path d={EKG_PATH} fill="currentColor" className="pulse-loader-sweep" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

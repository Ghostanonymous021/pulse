"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import {
  LIFESPAN_LABELS,
  type LifespanPreset,
} from "@/lib/posts/lifespan";
import { cn } from "@/lib/utils";

const PRESETS: LifespanPreset[] = ["permanent", "24h", "3d", "7d", "custom"];

/**
 * Bottom sheet: Permanente (padrao) | 24h | 3 dias | 7 dias | Personalizado.
 * Personalizado abre um datetime-local nativo — sem construir um date-picker
 * proprio (mesma filosofia de "usar o que a plataforma ja oferece bem").
 */
export function LifespanSheet({
  value,
  customDate,
  onClose,
  onConfirm,
}: {
  value: LifespanPreset;
  customDate: Date | null;
  onClose: () => void;
  onConfirm: (preset: LifespanPreset, customDate: Date | null) => void;
}) {
  const [selected, setSelected] = useState<LifespanPreset>(value);
  const [customValue, setCustomValue] = useState<string>(
    customDate ? toLocalInputValue(customDate) : "",
  );
  // Computado uma unica vez na montagem (nao a cada render) para nao violar
  // a regra de pureza do React (Date.now() e impuro durante o render).
  const [minValue] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 5 * 60 * 1000)),
  );

  function confirm() {
    if (selected === "custom") {
      const parsed = customValue ? new Date(customValue) : null;
      if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        return;
      }
      onConfirm("custom", parsed);
      return;
    }
    onConfirm(selected, null);
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-2xl bg-[var(--elevated)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between border-b border-[var(--separator)] px-4 py-3">
          <p className="text-[15px] font-semibold tracking-[-0.02em]">
            Tempo de vida
          </p>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-2 py-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setSelected(preset)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[14.5px] transition-colors",
                selected === preset ? "bg-muted/70" : "hover:bg-muted/40",
              )}
            >
              <span className={selected === preset ? "font-medium" : ""}>
                {LIFESPAN_LABELS[preset]}
              </span>
              {selected === preset && (
                <Check className="h-4 w-4 text-brand" strokeWidth={2} />
              )}
            </button>
          ))}

          {selected === "custom" && (
            <div className="px-3 py-2">
              <input
                type="datetime-local"
                value={customValue}
                min={minValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[14px] outline-none ring-foreground/10 focus:ring-2"
              />
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-1">
          <button
            type="button"
            onClick={confirm}
            disabled={selected === "custom" && !customValue}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-accent text-[14.5px] font-medium text-accent-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

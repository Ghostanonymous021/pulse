"use client";

import { useState } from "react";

export function DownloadDataButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/export", { method: "GET" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Falha ao exportar.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pulse-dados-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao exportar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 pt-2">
      <button
        type="button"
        disabled={loading}
        onClick={onClick}
        className="flex h-12 w-full items-center justify-center rounded-full bg-accent text-[15px] font-semibold tracking-[-0.02em] text-accent-foreground disabled:opacity-50"
      >
        {loading ? "A preparar..." : "Descarregar JSON"}
      </button>
      {error && (
        <p className="mt-2 text-center text-[13px] text-[#ff3b30]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

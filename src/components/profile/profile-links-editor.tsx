"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import {
  MAX_PROFILE_LINKS,
  type ProfileLink,
} from "@/lib/links/profile-links";
import { normalizeUrl } from "@/lib/links/urls";
import { createClient } from "@/lib/supabase/client";

export function ProfileLinksEditor({
  profileId,
  initial,
}: {
  profileId: string;
  initial: ProfileLink[];
}) {
  const router = useRouter();
  const [links, setLinks] = useState(initial);
  const [rotulo, setRotulo] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    const label = rotulo.trim();
    const normalized = normalizeUrl(url);
    if (!label) {
      setError("Indica um rotulo.");
      return;
    }
    if (!normalized) {
      setError("URL invalida.");
      return;
    }
    if (links.length >= MAX_PROFILE_LINKS) {
      setError(`No máximo ${MAX_PROFILE_LINKS} links.`);
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const ordem = links.length;
        const { data, error: insErr } = await supabase
          .from("profile_links")
          .insert({
            profile_id: profileId,
            rotulo: label.slice(0, 40),
            url: normalized,
            ordem,
          })
          .select("id, profile_id, rotulo, url, ordem, created_at")
          .single();
        if (insErr) throw insErr;
        setLinks((prev) => [...prev, data as ProfileLink]);
        setRotulo("");
        setUrl("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao adicionar.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("profile_links").delete().eq("id", id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
      router.refresh();
    });
  }

  function move(id: string, dir: -1 | 1) {
    const idx = links.findIndex((l) => l.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= links.length) return;
    const next = [...links];
    [next[idx], next[j]] = [next[j], next[idx]];
    const reordered = next.map((l, i) => ({ ...l, ordem: i }));
    setLinks(reordered);

    startTransition(async () => {
      const supabase = createClient();
      await Promise.all(
        reordered.map((l) =>
          supabase
            .from("profile_links")
            .update({ ordem: l.ordem })
            .eq("id", l.id),
        ),
      );
      router.refresh();
    });
  }

  return (
    <div className="mx-4 mt-6">
      <p className="mb-2 px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        Links
      </p>
      <p className="mb-3 px-1 text-[13px] text-muted-foreground">
        Ate {MAX_PROFILE_LINKS}. Mostra o rotulo, nunca a URL.
      </p>

      <ul className="overflow-hidden rounded-[12px] bg-card divide-y divide-[var(--separator)]">
        {links.length === 0 && (
          <li className="px-3.5 py-3.5 text-[14px] text-muted-foreground">
            Nenhum link ainda.
          </li>
        )}
        {links.map((l, i) => (
          <li
            key={l.id}
            className="flex min-h-[52px] items-center gap-2 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{l.rotulo}</p>
              <p className="truncate text-[12px] text-muted-foreground">
                {l.url}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label="Subir"
                disabled={pending || i === 0}
                onClick={() => move(l.id, -1)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-label="Descer"
                disabled={pending || i === links.length - 1}
                onClick={() => move(l.id, 1)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-label="Remover"
                disabled={pending}
                onClick={() => remove(l.id)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {links.length < MAX_PROFILE_LINKS && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={rotulo}
            onChange={(e) => setRotulo(e.target.value)}
            placeholder="Rotulo (ex: Portfolio)"
            maxLength={40}
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-[14px] outline-none focus:ring-2 focus:ring-foreground/10"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-[14px] outline-none focus:ring-2 focus:ring-foreground/10"
          />
          <button
            type="button"
            disabled={pending}
            onClick={add}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-[14px] font-semibold text-accent-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Adicionar link
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-[12px] text-[#ff3b30]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

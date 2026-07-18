"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { muteAuthor } from "@/lib/social/mute";
import { cn } from "@/lib/utils";

/**
 * Post overflow menu (⋯) — no follow (follow lives as header icon).
 * Own post: Apagar, Copiar ligacao.
 * Others: Ver perfil, Denunciar, Silenciar, Copiar ligacao.
 */
export function PostMenu({
  postId,
  authorId,
  authorUsername,
  onMuted,
}: {
  postId: string;
  authorId: string;
  authorUsername?: string | null;
  onMuted?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setIsOwner(user.id === authorId);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, authorId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setConfirmDelete(false);
    setReportOpen(false);
    setMessage(null);
  }

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Algo correu mal.");
      }
    });
  }

  async function deletePost() {
    const supabase = createClient();
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw error;
    close();
    router.push("/home");
    router.refresh();
  }

  async function reportPost(reason: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: "post",
      target_id: postId,
      reason,
    });
    if (error) throw error;
    setMessage("Denuncia enviada.");
    setReportOpen(false);
    setTimeout(close, 900);
  }

  async function copyLink() {
    const url = `${window.location.origin}/p/${postId}`;
    await navigator.clipboard.writeText(url);
    setMessage("Ligacao copiada.");
    setTimeout(() => setMessage(null), 1200);
  }

  function silenceAuthor() {
    muteAuthor(authorId);
    onMuted?.();
    setMessage("Conta silenciada neste dispositivo.");
    setTimeout(close, 700);
  }

  const sheet = open && mounted
    ? createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={close}
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Acoes da publicacao"
            className="relative z-10 w-full max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3"
          >
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--separator)] bg-[var(--elevated)] shadow-xl backdrop-blur-xl">
              {message && (
                <p className="border-b border-[var(--separator)] px-4 py-3 text-center text-[13px] text-muted-foreground">
                  {message}
                </p>
              )}

              {!confirmDelete && !reportOpen && (
                <ul className="divide-y divide-[var(--separator)]">
                  {isOwner ? (
                    <>
                      <SheetAction
                        label="Apagar publicacao"
                        destructive
                        disabled={busy}
                        onClick={() => setConfirmDelete(true)}
                      />
                      <SheetAction
                        label="Copiar ligacao"
                        disabled={busy}
                        onClick={() => run(copyLink)}
                      />
                    </>
                  ) : (
                    <>
                      {authorUsername && (
                        <SheetAction
                          label="Ver perfil"
                          disabled={busy}
                          onClick={() => {
                            close();
                            router.push(`/u/${authorUsername}`);
                          }}
                        />
                      )}
                      <SheetAction
                        label="Denunciar"
                        destructive
                        disabled={busy}
                        onClick={() => setReportOpen(true)}
                      />
                      <SheetAction
                        label="Silenciar"
                        disabled={busy}
                        onClick={() => run(async () => silenceAuthor())}
                      />
                      <SheetAction
                        label="Copiar ligacao"
                        disabled={busy}
                        onClick={() => run(copyLink)}
                      />
                    </>
                  )}
                  <SheetAction label="Cancelar" onClick={close} muted />
                </ul>
              )}

              {confirmDelete && (
                <ul className="divide-y divide-[var(--separator)]">
                  <li className="px-4 py-3 text-center text-[13px] text-muted-foreground">
                    Apagar esta publicacao? Nao da para reverter.
                  </li>
                  <SheetAction
                    label="Apagar"
                    destructive
                    disabled={busy}
                    onClick={() => run(deletePost)}
                  />
                  <SheetAction
                    label="Voltar"
                    muted
                    onClick={() => setConfirmDelete(false)}
                  />
                </ul>
              )}

              {reportOpen && (
                <ul className="divide-y divide-[var(--separator)]">
                  <li className="px-4 py-3 text-center text-[13px] text-muted-foreground">
                    Motivo da denuncia
                  </li>
                  {[
                    "Spam",
                    "Assedio ou abuso",
                    "Conteudo enganoso",
                    "Outro",
                  ].map((reason) => (
                    <SheetAction
                      key={reason}
                      label={reason}
                      disabled={busy}
                      onClick={() => run(() => reportPost(reason))}
                    />
                  ))}
                  <SheetAction
                    label="Voltar"
                    muted
                    onClick={() => setReportOpen(false)}
                  />
                </ul>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        type="button"
        aria-label="Mais acoes"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={1.5} />
      </button>
      {sheet}
    </>
  );
}

function SheetAction({
  label,
  onClick,
  destructive,
  muted,
  disabled,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex w-full items-center justify-center px-4 py-3.5 text-[16px] font-medium tracking-[-0.02em] transition-colors hover:bg-muted/60 disabled:opacity-50",
          destructive && "text-[#ff3b30]",
          muted && "font-normal text-muted-foreground",
        )}
      >
        {label}
      </button>
    </li>
  );
}

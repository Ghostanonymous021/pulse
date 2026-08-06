"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function ProfileMenu({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

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
    setConfirmBlock(false);
    setReportOpen(false);
    setMessage(null);
  }

  async function run(fn: () => Promise<void>) {
    setPending(true);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Algo correu mal. Tenta outra vez.");
    } finally {
      setPending(false);
    }
  }

  async function reportProfile(reason: string) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: "profile",
      target_id: userId,
      reason,
    });
    if (error) throw error;
    setMessage("Denúncia enviada.");
    setReportOpen(false);
    setTimeout(close, 900);
  }

  async function blockUser() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    const { error } = await supabase
      .from("blocks")
      .insert({ blocker_id: user.id, blocked_id: userId });
    if (error) throw error;
    close();
    router.push("/explorar");
    router.refresh();
  }

  const sheet =
    open
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
              aria-label="Ações do perfil"
              className="relative z-10 w-full max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3"
            >
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--separator)] bg-[var(--elevated)] shadow-xl backdrop-blur-xl">
                {message && (
                  <p className="border-b border-[var(--separator)] px-4 py-3 text-center text-[13px] text-muted-foreground">
                    {message}
                  </p>
                )}

                {!confirmBlock && !reportOpen && (
                  <ul className="divide-y divide-[var(--separator)]">
                    <SheetAction
                      label="Denunciar"
                      destructive
                      disabled={pending}
                      onClick={() => setReportOpen(true)}
                    />
                    <SheetAction
                      label="Bloquear"
                      destructive
                      disabled={pending}
                      onClick={() => setConfirmBlock(true)}
                    />
                    <SheetAction label="Cancelar" onClick={close} muted />
                  </ul>
                )}

                {confirmBlock && (
                  <ul className="divide-y divide-[var(--separator)]">
                    <li className="px-4 py-3 text-center text-[13px] text-muted-foreground">
                      Bloquear esta conta? Deixam de se seguir, de se ver
                      publicações e de trocar mensagens.
                    </li>
                    <SheetAction
                      label="Bloquear"
                      destructive
                      disabled={pending}
                      onClick={() => run(blockUser)}
                    />
                    <SheetAction
                      label="Voltar"
                      muted
                      onClick={() => setConfirmBlock(false)}
                    />
                  </ul>
                )}

                {reportOpen && (
                  <ul className="divide-y divide-[var(--separator)]">
                    <li className="px-4 py-3 text-center text-[13px] text-muted-foreground">
                      Motivo da denúncia
                    </li>
                    {["Spam", "Assédio ou abuso", "Perfil falso", "Outro"].map(
                      (reason) => (
                        <SheetAction
                          key={reason}
                          label={reason}
                          disabled={pending}
                          onClick={() => run(() => reportProfile(reason))}
                        />
                      ),
                    )}
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
        aria-label="Mais ações"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="rounded-full p-2.5 text-foreground/80 transition-all duration-200 ease-out hover:bg-muted active:scale-95"
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
          "flex w-full items-center justify-center px-4 py-3.5 text-[16px] font-medium tracking-[-0.02em] transition-all duration-200 ease-out hover:bg-muted/60 active:scale-95 disabled:opacity-50",
          destructive && "text-destructive",
          muted && "font-normal text-muted-foreground",
        )}
      >
        {label}
      </button>
    </li>
  );
}

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronRight } from "lucide-react";

import { UserAvatar } from "@/components/profile/user-avatar";
import { PulseLoader } from "@/components/ui/pulse-loader";
import { avatarFallbackTone } from "@/lib/profile/avatar";
import {
  FollowButton,
  type FollowUiState,
} from "@/components/social/follow-button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

export type OnboardingSuggestion = Pick<
  Profile,
  | "id"
  | "username"
  | "display_name"
  | "avatar_url"
  | "university"
  | "campus"
  | "course"
  | "account_type"
> & { followState: FollowUiState };

type Step = "welcome" | "campus" | "photo" | "follow";

const STEPS: Step[] = ["welcome", "campus", "photo", "follow"];

/**
 * Professional post-signup onboarding (IG/Linear-quality).
 * Optional at every step — never blocks entry to the app.
 */
export function OnboardingFlow({
  profile,
  suggestions,
}: {
  profile: Profile;
  suggestions: OnboardingSuggestion[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [university, setUniversity] = useState(profile.university ?? "");
  const [campus, setCampus] = useState(profile.campus ?? "");
  const [course, setCourse] = useState(profile.course ?? "");
  const [year, setYear] = useState(profile.year ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  function goHome() {
    startTransition(() => {
      router.push("/home");
      router.refresh();
    });
  }

  function next() {
    setError(null);
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]!);
    else goHome();
  }

  async function saveCampus() {
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const { error: upErr } = await supabase
        .from("profiles")
        .update({
          university: university.trim() || null,
          campus: campus.trim() || null,
          course: course.trim() || null,
          year: year.trim() || null,
        })
        .eq("id", profile.id);
      if (upErr) throw upErr;
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível guardar.");
    } finally {
      setUploading(false);
    }
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const { uploadProfileAvatar } = await import(
        "@/lib/profile/upload-avatar"
      );
      const { url } = await uploadProfileAvatar(
        supabase,
        profile.id,
        file,
      );
      setAvatarUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const initial = useMemo(
    () => (profile.display_name || profile.username || "?").slice(0, 1).toUpperCase(),
    [profile.display_name, profile.username],
  );

  return (
    <div
      data-app-chrome
      className="mx-auto flex min-h-full w-full max-w-lg flex-col"
    >
      {/* Progress */}
      <div className="px-6 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between py-3">
          <p className="text-[13px] font-medium tracking-[-0.01em] text-muted-foreground">
            Pulse
          </p>
          <button
            type="button"
            onClick={goHome}
            disabled={pending}
            className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Saltar
          </button>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
        >
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
        {step === "welcome" && (
          <StepShell
            title="Bem-vindo ao Pulse"
            subtitle="O teu espaco para pessoas, ideias e conversas que valem a pena. Sem ruido."
          >
            <div className="mt-10 flex flex-1 flex-col justify-end gap-3">
              <PrimaryButton onClick={next} label="Começar" />
            </div>
          </StepShell>
        )}

        {step === "campus" && (
          <StepShell
            title="Onde estudas"
            subtitle="Ajuda-nos a mostrar-te pessoas com quem faz sentido cruzar. Podes mudar isto sempre que quiseres."
          >
            <div className="mt-8 space-y-3">
              <Field
                label="Universidade"
                value={university}
                onChange={setUniversity}
                placeholder="Nome da tua universidade"
              />
              <Field
                label="Campus"
                value={campus}
                onChange={setCampus}
                placeholder="Xai-Xai, Maxixe…"
              />
              <Field
                label="Curso"
                value={course}
                onChange={setCourse}
                placeholder="Opcional"
              />
              <Field
                label="Ano"
                value={year}
                onChange={setYear}
                placeholder="Opcional"
              />
            </div>
            {error && (
              <p className="shake mt-3 text-[13px] text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="mt-auto space-y-3 pt-10">
              <PrimaryButton
                onClick={saveCampus}
                label="Continuar"
                disabled={uploading}
                loading={uploading}
              />
              <GhostButton onClick={next} label="Agora não" />
            </div>
          </StepShell>
        )}

        {step === "photo" && (
          <StepShell
            title="Foto de perfil"
            subtitle="As pessoas conhecem-te melhor com uma cara. Totalmente opcional."
          >
            <div className="mt-12 flex flex-1 flex-col items-center">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full text-[32px] font-semibold ring-1 ring-[var(--separator)] transition-all duration-200 ease-out hover:opacity-90 active:scale-95 disabled:opacity-50",
                  !avatarUrl && avatarFallbackTone(profile.id),
                )}
                aria-label="Escolher foto"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initial
                )}
                <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground shadow">
                  <Camera className="h-4 w-4" strokeWidth={1.5} />
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="file-input-native"
                onChange={(e) => onPickPhoto(e.target.files?.[0])}
              />
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground">
                {uploading && <PulseLoader size="sm" />}
                {uploading ? "A enviar..." : "Toca para escolher da galeria"}
              </p>
              {error && (
                <p className="shake mt-2 text-[13px] text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="mt-auto space-y-3 pt-10">
              <PrimaryButton
                onClick={next}
                label={avatarUrl ? "Continuar" : "Continuar sem foto"}
                disabled={uploading}
                loading={uploading}
              />
            </div>
          </StepShell>
        )}

        {step === "follow" && (
          <StepShell
            title="Comeca por seguir alguem"
            subtitle="O teu feed fica bom com as pessoas certas — comeca por estas."
          >
            <ul className="-mx-6 mt-6 max-h-[50vh] flex-1 divide-y divide-[var(--separator)] overflow-y-auto border-y border-[var(--separator)]">
              {suggestions.length === 0 && (
                <li className="px-6 py-12 text-center text-[14px] text-muted-foreground">
                  Ainda ha poucas pessoas por aqui. Se calhar es de quem comeca — explora e encontra as primeiras.
                </li>
              )}
              {suggestions.map((s) => {
                const meta = [s.campus, s.course].filter(Boolean).join(" · ");
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 px-4 py-3.5"
                  >
                    <UserAvatar
                      userId={s.id}
                      avatarUrl={s.avatar_url}
                      name={s.display_name || s.username}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">
                        {s.display_name || s.username}
                      </p>
                      <p className="truncate text-[13px] text-muted-foreground">
                        @{s.username}
                        {s.account_type === "organizacao" ? " · Organização" : ""}
                      </p>
                      {meta ? (
                        <p className="truncate text-[12px] text-muted-foreground">
                          {meta}
                        </p>
                      ) : null}
                    </div>
                    <FollowButton
                      targetUserId={s.id}
                      initialState={s.followState}
                      className="w-[7.25rem] shrink-0"
                    />
                  </li>
                );
              })}
            </ul>
            <div className="mt-auto space-y-3 pt-6">
              <PrimaryButton
                onClick={goHome}
                label="Entrar no Pulse"
                disabled={pending}
                loading={pending}
                icon
              />
              <p className="text-center text-[12px] text-muted-foreground">
                Podes seguir mais gente quando quiseres, em Explorar.
              </p>
            </div>
          </StepShell>
        )}
      </div>
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-foreground">
        {title}
      </h1>
      <p className="mt-2 max-w-[320px] text-[15px] leading-snug text-muted-foreground">
        {subtitle}
      </p>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-[12px] border-0 bg-card px-3.5 text-[16px] outline-none ring-1 ring-[var(--separator)] placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/20"
      />
    </label>
  );
}

function PrimaryButton({
  onClick,
  label,
  disabled,
  loading,
  icon,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-semibold tracking-[-0.02em] text-brand-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95 disabled:opacity-50"
    >
      {loading && <PulseLoader size="sm" tone="on-brand" />}
      {label}
      {icon ? <ChevronRight className="h-4 w-4" strokeWidth={2} /> : null}
    </button>
  );
}

function GhostButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-center text-[14px] font-medium text-muted-foreground transition-all duration-200 ease-out hover:text-foreground active:scale-95"
    >
      {label}
    </button>
  );
}

/** Tiny check for future step complete indicators */
export function OnboardingCheck({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded-full",
        done ? "bg-foreground text-background" : "bg-muted",
      )}
    >
      {done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
    </span>
  );
}

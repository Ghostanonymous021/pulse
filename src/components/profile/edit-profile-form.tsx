"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AvatarPicker } from "@/components/profile/avatar-picker";
import { PulseLoader } from "@/components/ui/pulse-loader";
import {
  isValidUsername,
  sanitizeUsernameInput,
} from "@/lib/auth/username";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

type FieldKey =
  | "displayName"
  | "username"
  | "bio"
  | "university"
  | "campus"
  | "course"
  | "year";

export function EditProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [university, setUniversity] = useState(profile.university ?? "");
  const [campus, setCampus] = useState(profile.campus ?? "");
  const [course, setCourse] = useState(profile.course ?? "");
  const [year, setYear] = useState(profile.year ?? "");
  const [active, setActive] = useState<FieldKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const usernameChanged =
    sanitizeUsernameInput(username) !== profile.username.toLowerCase();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const cleanUsername = sanitizeUsernameInput(username);

      if (!isValidUsername(cleanUsername)) {
        throw new Error(
          "Username: 3–30 caracteres, a-z, 0-9, ponto ou underscore.",
        );
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          username: cleanUsername,
          bio: bio.trim() || null,
          university: university.trim() || null,
          campus: campus.trim() || null,
          course: course.trim() || null,
          year: year.trim() || null,
        })
        .eq("id", profile.id);

      if (updateError) {
        if (updateError.message.toLowerCase().includes("username")) {
          throw new Error("Esse username ja está em uso.");
        }
        throw updateError;
      }

      router.push("/perfil/definicoes");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível guardar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="pb-10">
      <div className="px-4 pt-5">
        <AvatarPicker
          userId={profile.id}
          avatarUrl={profile.avatar_url}
          name={displayName || profile.username}
        />
      </div>

      <ul className="mx-4 mt-6 overflow-hidden rounded-[12px] bg-card divide-y divide-[var(--separator)]">
        <EditRow
          label="Nome"
          fieldKey="displayName"
          value={displayName}
          placeholder="Nome"
          active={active}
          onActivate={setActive}
          onChange={setDisplayName}
        />
        <EditRow
          label="Username"
          fieldKey="username"
          value={username}
          placeholder="username"
          active={active}
          onActivate={setActive}
          onChange={(v) => setUsername(sanitizeUsernameInput(v))}
        />
        <EditRow
          label="Bio"
          fieldKey="bio"
          value={bio}
          placeholder="Uma linha"
          active={active}
          onActivate={setActive}
          onChange={setBio}
          multiline
          maxLength={160}
        />
      </ul>

      {(usernameChanged || active === "username") && (
        <p className="mx-4 mt-2 px-1 text-[12px] leading-relaxed text-muted-foreground">
          Podes alterar o teu username, mas faze-lo com frequencia pode
          confundir quem ja te segue.
        </p>
      )}

      <p className="mx-4 mb-2 mt-6 px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        Universidade
      </p>
      <ul className="mx-4 overflow-hidden rounded-[12px] bg-card divide-y divide-[var(--separator)]">
        <EditRow
          label="Universidade"
          fieldKey="university"
          value={university}
          placeholder="Opcional"
          active={active}
          onActivate={setActive}
          onChange={setUniversity}
        />
        <EditRow
          label="Campus"
          fieldKey="campus"
          value={campus}
          placeholder="Opcional"
          active={active}
          onActivate={setActive}
          onChange={setCampus}
        />
        <EditRow
          label="Curso"
          fieldKey="course"
          value={course}
          placeholder="Opcional"
          active={active}
          onActivate={setActive}
          onChange={setCourse}
        />
        <EditRow
          label="Ano"
          fieldKey="year"
          value={year}
          placeholder="Opcional"
          active={active}
          onActivate={setActive}
          onChange={setYear}
        />
      </ul>

      {error && (
        <p className="mx-4 mt-4 text-[13px] text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mx-4 mt-6">
        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold tracking-[-0.02em] text-accent-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95 disabled:opacity-50"
        >
          {loading && <PulseLoader size="sm" />}
          {loading ? "A guardar..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function EditRow({
  label,
  fieldKey,
  value,
  placeholder,
  active,
  onActivate,
  onChange,
  multiline,
  maxLength,
}: {
  label: string;
  fieldKey: FieldKey;
  value: string;
  placeholder: string;
  active: FieldKey | null;
  onActivate: (k: FieldKey | null) => void;
  onChange: (v: string) => void;
  multiline?: boolean;
  maxLength?: number;
}) {
  const isOpen = active === fieldKey;
  const display = value.trim() || placeholder;
  const empty = !value.trim();

  if (!isOpen) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onActivate(fieldKey)}
          className="flex min-h-[48px] w-full items-center gap-3 px-3.5 py-2.5 text-left active:bg-muted/50"
        >
          <span className="w-[100px] shrink-0 text-[15px] tracking-[-0.01em]">
            {label}
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-right text-[15px] tracking-[-0.01em]",
              empty ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {multiline && value.length > 40 ? `${value.slice(0, 40)}…` : display}
          </span>
        </button>
      </li>
    );
  }

  return (
    <li className="px-3.5 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onActivate(null)}
          className="text-[13px] font-medium text-muted-foreground"
        >
          Fechar
        </button>
      </div>
      {multiline ? (
        <textarea
          autoFocus
          rows={3}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full resize-none rounded-[10px] bg-muted/50 px-3 py-2.5 text-[15px] outline-none ring-1 ring-[var(--separator)] focus:ring-2 focus:ring-foreground/20"
        />
      ) : (
        <input
          autoFocus
          type="text"
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-[10px] bg-muted/50 px-3 text-[15px] outline-none ring-1 ring-[var(--separator)] focus:ring-2 focus:ring-foreground/20"
        />
      )}
    </li>
  );
}

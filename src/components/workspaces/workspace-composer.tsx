"use client";

import { useState, useRef } from "react";
import { Plus, Link2, Paperclip, Image as ImageIcon } from "lucide-react";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { CreateEntryInput, ProjectRole } from "@/lib/workspaces/types";

const ENTRY_TYPE_OPTIONS = [
  { type: "text" as const, label: "Nota", icon: Plus },
  { type: "link" as const, label: "Link", icon: Link2 },
  { type: "file" as const, label: "Ficheiro", icon: Paperclip },
  { type: "image" as const, label: "Imagem", icon: ImageIcon },
] as const;

export function WorkspaceComposer({
  projectId,
  role,
  onCreated,
}: {
  projectId: string;
  role: ProjectRole | null;
  onCreated?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [entryType, setEntryType] = useState<CreateEntryInput["entryType"]>("text");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const canPost = role === "owner" || role === "admin" || role === "member";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost || loading) return;

    const supabase = createClient();
    setLoading(true);

    let filePath: string | undefined;
    let fileName: string | undefined;
    let mimeType: string | undefined;
    let fileSize: number | undefined;

    if (file && (entryType === "file" || entryType === "image")) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("workspace-media")
        .upload(path, file);
      if (upErr) {
        console.error("upload failed", upErr.message);
        setLoading(false);
        return;
      }
      filePath = path;
      fileName = file.name;
      mimeType = file.type;
      fileSize = file.size;
    }

    const { error } = await supabase.from("project_entries").insert({
      project_id: projectId,
      author_id: (await supabase.auth.getSession()).data.session?.user?.id || "",
      entry_type: entryType,
      body: body.trim() || null,
      url: url.trim() || null,
      file_path: filePath || null,
      file_name: fileName || null,
      file_size: fileSize || null,
      mime_type: mimeType || null,
    });

    if (error) {
      console.error("create entry", error.message);
      setLoading(false);
      return;
    }

    setBody("");
    setUrl("");
    setFile(null);
    setEntryType("text");
    setLoading(false);
    router.refresh();
    onCreated?.();
  }

  if (!canPost) return null;

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[var(--separator)] bg-card p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Escreve uma nota..."
        rows={2}
        className="w-full resize-none bg-transparent text-[15px] leading-[1.55] tracking-[-0.01em] outline-none placeholder:text-muted-foreground"
      />

      {entryType === "link" && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="mt-2 w-full rounded-xl border border-[var(--separator)] bg-muted/50 px-3 py-2 text-[14px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/10"
        />
      )}

      {entryType === "file" || entryType === "image" ? (
        <div className="mt-2">
          <input
            ref={fileRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-[13px] text-muted-foreground"
          />
          {file && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-1">
          {ENTRY_TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => setEntryType(type)}
              className={`
                flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-all duration-200 ease-out
                ${
                  entryType === type
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground active:scale-95"
                }
              `}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || (!body.trim() && !url.trim() && !file)}
          className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Enviar
        </button>
      </div>
    </form>
  );
}

import type { WorkspaceEntryWithAuthor } from "@/lib/workspaces/types";

export function WorkspaceEntryCard({
  entry,
  isAuthor,
  isEditable,
  onEdit,
  onDelete,
}: {
  entry: WorkspaceEntryWithAuthor;
  isAuthor: boolean;
  isEditable: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  if (entry.entry_type === "text" || entry.entry_type === "link") {
    return (
      <div className="group rounded-2xl border border-[var(--separator)] bg-card p-4 transition-all duration-200">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <div className="h-5 w-5 rounded-full bg-muted ring-2 ring-card">
            {entry.author?.avatar_url ? (
              <img
                src={entry.author.avatar_url}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold">
                {entry.author?.display_name?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
            )}
          </div>
          <span className="font-medium text-foreground/80">
            {entry.author?.display_name || entry.author?.username}
          </span>
          <span className="text-muted-foreground">
            {new Date(entry.created_at).toLocaleDateString("pt-PT", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {entry.body && (
          <div
            data-user-content
            className="mt-2 text-[15px] leading-[1.55] tracking-[-0.01em] whitespace-pre-wrap"
          >
            {entry.body}
          </div>
        )}

        {entry.url && (
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block rounded-xl border border-[var(--separator)] bg-muted/50 p-3 transition-colors hover:bg-muted"
          >
            <span className="text-[13px] text-foreground/80 underline-offset-4 hover:underline">
              {entry.url}
            </span>
          </a>
        )}

        {(isAuthor || isEditable) && (
          <div className="mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            {onEdit && (
              <button
                onClick={onEdit}
                className="rounded-full border border-[var(--separator)] bg-muted px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted/80"
              >
                Editar
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="rounded-full border border-[var(--separator)] bg-muted px-3 py-1.5 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (entry.entry_type === "file" || entry.entry_type === "image") {
    return (
      <div className="group rounded-2xl border border-[var(--separator)] bg-card transition-all duration-200">
        {entry.file_url && (
          <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.file_url}
              alt={entry.file_name || "Ficheiro"}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <div className="h-5 w-5 rounded-full bg-muted ring-2 ring-card">
              {entry.author?.avatar_url ? (
                <img
                  src={entry.author.avatar_url}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold">
                  {entry.author?.display_name?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <span className="font-medium text-foreground/80">
              {entry.author?.display_name || entry.author?.username}
            </span>
            <span>{entry.file_name}</span>
          </div>

          {entry.body && (
            <p
              data-user-content
              className="mt-2 text-[15px] leading-[1.55] tracking-[-0.01em]"
            >
              {entry.body}
            </p>
          )}

          {(isAuthor || isEditable) && (
            <div className="mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="rounded-full border border-[var(--separator)] bg-muted px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted/80"
                >
                  Editar
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="rounded-full border border-[var(--separator)] bg-muted px-3 py-1.5 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--separator)] bg-card p-4 text-[13px] text-muted-foreground">
      {entry.author?.display_name ?? entry.author?.username}: {entry.entry_type}
    </div>
  );
}

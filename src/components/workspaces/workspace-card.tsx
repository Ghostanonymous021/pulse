import Link from "next/link";

import type { WorkspaceWithMeta } from "@/lib/workspaces/types";

export function WorkspaceCard({
  workspace,
}: {
  workspace: WorkspaceWithMeta;
}) {
  return (
    <Link
      href={`/w/${workspace.id}`}
      className="group block rounded-2xl border border-[var(--separator)] bg-card transition-all duration-200 ease-out active:scale-[0.98]"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold tracking-[-0.02em]">
              {workspace.name}
            </h3>
            {workspace.description && (
              <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
                {workspace.description}
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full border border-[var(--separator)] bg-muted px-2.5 py-1 text-[11px] font-medium capitalize tracking-[-0.01em] text-muted-foreground">
            {workspace.visibility}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-4 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <div className="flex -space-x-2">
              {workspace.members?.slice(0, 3).map((m) => (
                <div
                  key={m.user_id}
                  className="h-5 w-5 rounded-full bg-muted ring-2 ring-card"
                  title={m.user.display_name || m.user.username}
                />
              ))}
            </div>
            <span>{workspace.members_count}</span>
          </span>
          <span className="flex items-center gap-1">
            {workspace.entries_count} entradas
          </span>
        </div>
      </div>
    </Link>
  );
}

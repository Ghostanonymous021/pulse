"use client";

import type { ProjectMemberWithUser } from "@/lib/workspaces/types";

export function MemberSheet({
  members,
}: {
  members: ProjectMemberWithUser[];
}) {
  return (
    <div className="mt-4">
      <h3 className="text-[14px] font-semibold tracking-[-0.01em]">
        Colaboradores
      </h3>

      <div className="mt-3 flex flex-col gap-2">
        {members.map((m) => (
          <div
            key={m.user_id}
            className="flex items-center justify-between rounded-xl border border-[var(--separator)] bg-card px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted ring-2 ring-card">
                {m.user.avatar_url ? (
                  <img
                    src={m.user.avatar_url}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[12px] font-semibold">
                    {m.user.display_name?.charAt(0)?.toUpperCase() ??
                      m.user.username?.charAt(0)?.toUpperCase() ??
                      "?"}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[14px] font-medium">
                  {m.user.display_name || m.user.username}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  @{m.user.username}
                </p>
              </div>
            </div>

            <span className="rounded-full border border-[var(--separator)] bg-muted px-2.5 py-1 text-[11px] font-medium capitalize text-muted-foreground">
              {m.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

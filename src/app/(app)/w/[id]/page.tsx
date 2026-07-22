import { Star } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/nav/page-header";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadWorkspace, loadEntries, loadMembers } from "@/lib/workspaces/lib";
import { WorkspaceComposer } from "@/components/workspaces/workspace-composer";
import { WorkspaceEntryCard } from "@/components/workspaces/workspace-entry-card";
import { MemberSheet } from "@/components/workspaces/member-sheet";

async function toggleStarAction(projectId: string, userId: string, starred: boolean) {
  "use server";
  const supabase = await createClient();
  await supabase.from("project_stars").delete().eq("project_id", projectId).eq("user_id", userId);
  if (!starred) {
    await supabase.from("project_stars").insert({ project_id: projectId, user_id: userId });
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const workspace = await loadWorkspace(supabase, id, "");
  if (!workspace) return { title: "Espaço não encontrado" };
  return { title: workspace.name };
}

export default async function EspacoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const workspace = await loadWorkspace(supabase, id, profile.id);
  if (!workspace) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="text-[15px] font-medium">Espaço não encontrado</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Verifica o endereço ou pede acesso ao proprietário.
        </p>
        <Link
          href="/w"
          className="mt-4 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-foreground"
        >
          Ver espaços
        </Link>
      </div>
    );
  }

  const isMember =
    workspace.visibility === "public" ||
    workspace.visibility === "unlisted" ||
    !!workspace.viewer_role;

  if (!isMember && workspace.visibility === "private") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="text-[15px] font-medium">Espaço privado</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Apenas membros podem ver este espaço.
        </p>
      </div>
    );
  }

  const [members, entries] = await Promise.all([
    loadMembers(supabase, id),
    loadEntries(supabase, id, { limit: 30 }),
  ]);

  const isOwner = workspace.viewer_role === "owner";
  const isAdmin = workspace.viewer_role === "admin";
  const canEdit = isOwner || isAdmin;

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader
        title={workspace.name}
        right={
          <div className="flex items-center gap-1">
            <form
              action={async () => {
                "use server";
                await toggleStarAction(workspace.id, profile.id, workspace.viewer_starred);
              }}
            >
              <button
                type="submit"
                aria-label={workspace.viewer_starred ? "Remover star" : "Adicionar star"}
                className={`
                  flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ease-out
                  ${workspace.viewer_starred ? "text-brand" : "text-muted-foreground hover:text-foreground active:scale-95"}
                `}
              >
                <Star
                  className="h-5 w-5"
                  strokeWidth={workspace.viewer_starred ? 0 : 1.5}
                  fill={workspace.viewer_starred ? "currentColor" : "none"}
                />
              </button>
            </form>
            <span className="text-[13px] tabular-nums text-muted-foreground">
              {workspace.stars_count}
            </span>

            {canEdit && (
              <Link
                href={`/w/${workspace.id}/editar`}
                className="ml-2 rounded-full border border-[var(--separator)] bg-muted px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted/80"
              >
                Editar
              </Link>
            )}
          </div>
        }
      />

      <div className="px-4">
        {workspace.description && (
          <p
            data-user-content
            className="mt-2 text-[15px] leading-[1.55] tracking-[-0.01em] text-foreground/80"
          >
            {workspace.description}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3 text-[13px] text-muted-foreground">
          <span className="rounded-full border border-[var(--separator)] bg-muted px-2.5 py-1 capitalize">
            {workspace.visibility}
          </span>
          <span>{workspace.members_count} membros</span>
          <span>{workspace.entries_count} entradas</span>
        </div>

        <MemberSheet members={members} />

        <div className="mt-4 border-t border-[var(--separator)] pt-4">
          {entries.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[14px] text-muted-foreground">
                Ainda sem movimento.
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Envia a primeira nota.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((entry) => (
                <WorkspaceEntryCard
                  key={entry.id}
                  entry={entry}
                  isAuthor={entry.author_id === profile.id}
                  isEditable={!!workspace.viewer_role}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {!!workspace.viewer_role && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--separator)] bg-[var(--elevated)] backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto max-w-3xl px-4 pb-[env(safe-area-inset-bottom)]">
            <WorkspaceComposer
              projectId={workspace.id}
              role={workspace.viewer_role}
            />
          </div>
        </div>
      )}
    </div>
  );
}

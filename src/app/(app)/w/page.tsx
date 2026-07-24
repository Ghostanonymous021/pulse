import { PageHeader } from "@/components/nav/page-header";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadVisibleWorkspaces } from "@/lib/workspaces/lib";
import { WorkspaceCard } from "@/components/workspaces/workspace-card";
import Link from "next/link";

export const metadata = {
  title: "Espaços",
};

export default async function EspacosPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const workspaces = await loadVisibleWorkspaces(supabase, profile.id, {
    limit: 50,
  });

  const mine = workspaces.filter((w) => w.user_id === profile.id);
  const publicOnes = workspaces.filter((w) => w.visibility === "public" && w.user_id !== profile.id);

  return (
    <div className="pb-4">
      <PageHeader title="Espaços" />

      <div className="px-4">
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[14px] text-muted-foreground">
            {workspaces.length === 0
              ? "Ainda nao fazes parte de nenhum espaco."
              : `${workspaces.length} espaço(s)`}
          </p>
        </div>

        {mine.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Os teus espaços
            </h2>
            <div className="grid gap-3">
              {mine.map((ws) => (
                <WorkspaceCard key={ws.id} workspace={ws} />
              ))}
            </div>
          </div>
        )}

        {publicOnes.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Descobrir
            </h2>
            <div className="grid gap-3">
              {publicOnes.map((ws) => (
                <WorkspaceCard key={ws.id} workspace={ws} />
              ))}
            </div>
          </div>
        )}

        {workspaces.length === 0 && (
          <div className="mt-12 flex flex-col items-center justify-center px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <span className="text-[18px] font-semibold text-muted-foreground">
                +
              </span>
            </div>
            <p className="mt-4 text-[15px] font-medium">
              Ainda sem espacos
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Cria o teu primeiro espaco e comeca a partilhar ideias.
            </p>
            <Link
              href="/w/new"
              className="mt-4 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-foreground"
            >
              Criar espaço
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

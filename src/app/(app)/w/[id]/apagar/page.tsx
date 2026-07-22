import { PageHeader } from "@/components/nav/page-header";
import Link from "next/link";

import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/workspaces/lib";

import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const workspace = await loadWorkspace(supabase, id, "");
  if (!workspace) return { title: "Espaço não encontrado" };
  return { title: `Apagar ${workspace.name}` };
}

export default async function ApagarEspacoPage({ params }: Props) {
  const { profile } = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const workspace = await loadWorkspace(supabase, id, profile.id);
  if (!workspace || workspace.viewer_role !== "owner") {
    return (
      <div className="flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[15px] font-medium">Nao autorizado</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Apenas o owner pode apagar este espaço.
        </p>
      </div>
    );
  }

  async function deleteAction() {
    "use server";

    const { profile } = await requireProfile();
    const supabase = await createClient();

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", profile.id);

    if (error) {
      console.error("deleteAction", error.message);
      return;
    }

    redirect("/w");
  }

  return (
    <div className="px-4 py-6">
      <PageHeader title={`Apagar: ${workspace.name}`} />

      <div className="rounded-2xl border border-[var(--separator)] bg-card p-4">
        <p className="text-[15px] font-medium">
          Tens a certeza que queres apagar este espaço?
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Esta ação e irreversível. Todas as entradas e membros serao
          removidos.
        </p>

        <form action={deleteAction} className="mt-4">
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-full bg-destructive text-[15px] font-semibold text-white transition-all duration-200 ease-out hover:opacity-90 active:scale-95"
          >
            Apagar espaco
          </button>
        </form>

        <Link
          href={`/w/${id}`}
          className="mt-3 flex h-11 w-full items-center justify-center rounded-full border border-[var(--separator)] text-[14px] font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          Cancelar
        </Link>
      </div>
    </div>
  );
}

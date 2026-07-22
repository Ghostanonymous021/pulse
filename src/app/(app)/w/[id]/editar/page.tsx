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
  return { title: `Editar ${workspace.name}` };
}

export default async function EditarEspacoPage({ params }: Props) {
  const { profile } = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const workspace = await loadWorkspace(supabase, id, profile.id);
  if (!workspace || workspace.viewer_role !== "owner") {
    return (
      <div className="flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[15px] font-medium">Nao autorizado</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Apenas o owner pode editar este espaço.
        </p>
      </div>
    );
  }

  async function updateAction(formData: FormData) {
    "use server";

    const { profile } = await requireProfile();
    const supabase = await createClient();

    const name = (formData.get("name") as string)?.trim() || "";
    const description = (formData.get("description") as string)?.trim() || null;
    const visibility = (formData.get("visibility") as string) || "public";

    const { error } = await supabase
      .from("projects")
      .update({
        name,
        description,
        visibility,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", profile.id);

    if (error) {
      return { msg: error.message };
    }

    redirect(`/w/${id}`);
  }

  return (
    <div>
      <PageHeader title={`Editar: ${workspace.name}`} />

      <form action={updateAction} className="px-4 py-4">
        <div className="space-y-4">
          <div>
            <label className="block text-[14px] font-medium">
              Nome do espaço
            </label>
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={workspace.name}
              className="mt-1.5 w-full rounded-xl border border-[var(--separator)] bg-muted/50 px-4 py-3 text-[15px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/10"
            />
          </div>

          <div>
            <label className="block text-[14px] font-medium">
              Descricao
            </label>
            <textarea
              name="description"
              maxLength={1000}
              rows={3}
              defaultValue={workspace.description || ""}
              className="mt-1.5 w-full rounded-xl border border-[var(--separator)] bg-muted/50 px-4 py-3 text-[15px] outline-none resize-none placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/10"
            />
          </div>

          <div>
            <label className="block text-[14px] font-medium">
              Visibilidade
            </label>
            <select
              name="visibility"
              defaultValue={workspace.visibility}
              className="mt-1.5 w-full rounded-xl border border-[var(--separator)] bg-muted/50 px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-foreground/10"
            >
              <option value="public">Publico</option>
              <option value="unlisted">Nao listado</option>
              <option value="private">Privado</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex h-12 flex-1 items-center justify-center rounded-full bg-accent text-[15px] font-semibold tracking-[-0.02em] text-accent-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95"
            >
              Guardar alteracoes
            </button>
            <Link
              href={`/w/${id}/apagar`}
              className="flex h-12 items-center justify-center rounded-full border border-[var(--separator)] bg-muted px-4 text-[15px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              Apagar
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}

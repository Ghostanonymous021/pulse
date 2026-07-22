import { redirect } from "next/navigation";

import { PageHeader } from "@/components/nav/page-header";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createWorkspace } from "@/lib/workspaces/lib";

export const metadata = {
  title: "Novo espaço",
};

export default async function NovoEspacoPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  async function createAction(formData: FormData) {
    "use server";

    const { profile } = await requireProfile();
    const supabase = await createClient();

    const name = (formData.get("name") as string)?.trim() || "";
    const description = (formData.get("description") as string)?.trim() || null;
    const visibility = (formData.get("visibility") as string) || "public";
    const inviteesRaw = (formData.get("invitees") as string) || "";
    const invitees = inviteesRaw
      .split(/[,\n]+/)
      .map((u) => u.trim())
      .filter(Boolean);

    const { data, error } = await createWorkspace(supabase, profile.id, {
      name,
      description,
      visibility: visibility as "public" | "private" | "unlisted",
      inviteeUsernames: invitees,
    });

    if (error || !data) {
      console.error("createAction", error);
      return;
    }

    redirect(`/w/${data.id}`);
  }

  return (
    <div>
      <PageHeader title="Novo espaço" />

      <form action={createAction} className="px-4 py-4">
        <div className="space-y-4">
          <div>
            <label className="block text-[14px] font-medium">
              Nome do espaço
            </label>
            <input
              name="name"
              required
              maxLength={120}
              placeholder="ex. Sprint de produto"
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
              placeholder="O que é este espaço?"
              className="mt-1.5 w-full rounded-xl border border-[var(--separator)] bg-muted/50 px-4 py-3 text-[15px] outline-none resize-none placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/10"
            />
          </div>

          <div>
            <label className="block text-[14px] font-medium">
              Visibilidade
            </label>
            <select
              name="visibility"
              defaultValue="public"
              className="mt-1.5 w-full rounded-xl border border-[var(--separator)] bg-muted/50 px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-foreground/10"
            >
              <option value="public">Publico</option>
              <option value="unlisted">Nao listado</option>
              <option value="private">Privado</option>
            </select>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Publico: qualquer utilizador autenticado pode ver. Privado: so
              membros acedem.
            </p>
          </div>

          <div>
            <label className="block text-[14px] font-medium">
              Convidados (opcional)
            </label>
            <textarea
              name="invitees"
              rows={2}
              placeholder="Usernames separados por virgula"
              className="mt-1.5 w-full rounded-xl border border-[var(--separator)] bg-muted/50 px-4 py-3 text-[15px] outline-none resize-none placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/10"
            />
          </div>

          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-full bg-accent text-[15px] font-semibold tracking-[-0.02em] text-accent-foreground transition-all duration-200 ease-out hover:opacity-90 active:scale-95"
          >
            Criar espaco
          </button>
        </div>
      </form>
    </div>
  );
}

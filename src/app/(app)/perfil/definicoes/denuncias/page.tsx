import { PageHeader } from "@/components/nav/page-header";
import { requireProfile } from "@/lib/auth/session";

export const metadata = { title: "Historico de denuncias" };

const TARGET_LABEL: Record<string, string> = {
  post: "Publicação",
  profile: "Perfil",
  message: "Mensagem",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  reviewed: "Revista",
  actioned: "Accao tomada",
};

export default async function DenunciasPage() {
  const { supabase, profile } = await requireProfile();

  const { data: reports } = await supabase
    .from("reports")
    .select("id, target_type, reason, status, created_at, is_priority")
    .eq("reporter_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const list = reports ?? [];

  return (
    <div className="pb-12">
      <PageHeader title="Historico de denuncias" backHref="/perfil/definicoes" />

      {list.length === 0 ? (
        <p className="px-4 py-16 text-center text-[14px] text-muted-foreground">
          Ainda nao enviaste denuncias.
        </p>
      ) : (
        <ul className="mx-4 mt-4 overflow-hidden rounded-[12px] bg-card divide-y divide-[var(--separator)]">
          {list.map((r) => {
            const when = new Date(r.created_at).toLocaleDateString("pt-PT", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            return (
              <li key={r.id} className="px-3.5 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] font-medium tracking-[-0.01em]">
                    {TARGET_LABEL[r.target_type] ?? r.target_type}
                  </p>
                  <p className="shrink-0 text-[12px] text-muted-foreground">
                    {when}
                  </p>
                </div>
                <p className="mt-1 line-clamp-2 text-[14px] text-muted-foreground">
                  {r.reason}
                </p>
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  {STATUS_LABEL[r.status] ?? r.status}
                  {r.is_priority ? " · prioritaria" : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

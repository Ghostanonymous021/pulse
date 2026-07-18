import { PageHeader } from "@/components/nav/page-header";
import { requireProfile } from "@/lib/auth/session";

export const metadata = { title: "Ajuda e suporte" };

export default async function AjudaPage() {
  await requireProfile();

  return (
    <div className="pb-12">
      <PageHeader title="Ajuda e suporte" backHref="/perfil/definicoes" />
      <div className="space-y-4 px-4 pt-4">
        <ul className="overflow-hidden rounded-[12px] bg-card divide-y divide-[var(--separator)]">
          <li className="px-3.5 py-3.5">
            <p className="text-[15px] font-medium tracking-[-0.01em]">
              Contacto
            </p>
            <p className="mt-1 text-[14px] text-muted-foreground">
              suporte@pulse.app
            </p>
          </li>
          <li className="px-3.5 py-3.5">
            <p className="text-[15px] font-medium tracking-[-0.01em]">
              Campi cobertos
            </p>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Xai-Xai · Maxixe · Massinga · Manhica
            </p>
          </li>
        </ul>
      </div>
    </div>
  );
}

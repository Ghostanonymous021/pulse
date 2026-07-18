import { PageHeader } from "@/components/nav/page-header";
import { requireProfile } from "@/lib/auth/session";

export const metadata = { title: "Politica de privacidade" };

export default async function PoliticaPrivacidadePage() {
  await requireProfile();

  return (
    <div className="pb-12">
      <PageHeader
        title="Politica de privacidade"
        backHref="/perfil/definicoes"
      />
      <article className="space-y-4 px-4 pt-4 text-[15px] leading-relaxed text-foreground/90">
        <p>
          Tratamos os teus dados para operar a conta, o feed, as mensagens e a
          seguranca da rede universitaria.
        </p>
        <p>
          Curso, campus e universidade sao opcionais e controlados por ti.
          Contas privadas limitam quem ve as publicacoes.
        </p>
        <p>
          Podes descarregar os teus dados ou apagar a conta nas definicoes.
          Dados de recuperacao (e-mail) so existem se os configurares.
        </p>
        <p className="text-[13px] text-muted-foreground">
          Versao preliminar · UNISAVE · 2026
        </p>
      </article>
    </div>
  );
}

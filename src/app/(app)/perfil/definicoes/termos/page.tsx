import { PageHeader } from "@/components/nav/page-header";
import { requireProfile } from "@/lib/auth/session";

export const metadata = { title: "Termos de uso" };

export default async function TermosPage() {
  await requireProfile();

  return (
    <div className="pb-12">
      <PageHeader title="Termos de uso" backHref="/perfil/definicoes" />
      <article className="space-y-4 px-4 pt-4 text-[15px] leading-relaxed text-foreground/90">
        <p>
          O Pulse e a camada social das universidades. Ao usares a app,
          aceitas estas regras basicas de utilizacao.
        </p>
        <p>
          Publicas apenas conteudo que tens o direito de partilhar. Nao
          uses a plataforma para assedio, spam, fraude ou qualquer actividade
          ilegal.
        </p>
        <p>
          Contas podem ser suspensas ou removidas se violarem estas regras ou
          a politica de privacidade.
        </p>
        <p className="text-[13px] text-muted-foreground">
          Versao preliminar · 2026
        </p>
      </article>
    </div>
  );
}

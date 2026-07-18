"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Building2,
  Check,
  ChevronLeft,
  Clock,
  Megaphone,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/nav/page-header";
import {
  ORG_TYPE_OPTIONS,
  type ProfessionalOrgType,
  type ProfessionalRequest,
  type ProfessionalRequestStatus,
} from "@/lib/settings/professional";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * 3-screen professional mode request (not an instant switch).
 * Approval: Supabase Table Editor only — no in-app admin.
 *
 * 1 Intro → 2 Form → 3 Confirmation / status
 */
type Step = 1 | 2 | 3 | "status";

export function ProfessionalFlow({
  initialRequest,
  isOrg,
}: {
  initialRequest: ProfessionalRequest | null;
  isOrg: boolean;
}) {
  const router = useRouter();
  const startStep = useMemo((): Step => {
    if (isOrg) return "status";
    if (initialRequest?.status === "pending") return "status";
    if (initialRequest?.status === "rejected") return "status";
    if (initialRequest?.status === "approved") return "status";
    return 1;
  }, [initialRequest, isOrg]);

  const [step, setStep] = useState<Step>(startStep);
  const [request, setRequest] = useState(initialRequest);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<ProfessionalOrgType | "">("");
  const [tipoDetalhe, setTipoDetalhe] = useState("");
  const [descricao, setDescricao] = useState("");
  const [contacto, setContacto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const status: ProfessionalRequestStatus | "active" | null = isOrg
    ? "active"
    : request?.status ?? null;

  function submit() {
    setError(null);
    const cleanNome = nome.trim();
    const cleanDesc = descricao.trim();
    const cleanContact = contacto.trim();
    const cleanDetalhe = tipoDetalhe.trim();

    if (cleanNome.length < 2) {
      setError("Indica o nome oficial.");
      return;
    }
    if (!tipo) {
      setError("Escolhe o tipo.");
      return;
    }
    if (tipo === "outro" && cleanDetalhe.length < 2) {
      setError("Especifica o tipo de organizacao.");
      return;
    }
    if (cleanDesc.length < 1) {
      setError("Escreve uma descricao curta.");
      return;
    }
    if (cleanDesc.length > 200) {
      setError("Descricao: maximo 200 caracteres.");
      return;
    }
    if (cleanContact.length < 3) {
      setError("Indica um contacto de verificacao.");
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Sessao expirada.");

        const { data, error: insertError } = await supabase
          .from("professional_requests")
          .insert({
            profile_id: user.id,
            nome_organizacao: cleanNome,
            tipo_organizacao: tipo,
            tipo_detalhe: tipo === "outro" ? cleanDetalhe : null,
            descricao: cleanDesc,
            contacto: cleanContact,
            status: "pending",
          })
          .select(
            "id, profile_id, nome_organizacao, tipo_organizacao, tipo_detalhe, descricao, contacto, status, created_at, reviewed_at",
          )
          .single();

        if (insertError) throw insertError;
        setRequest(data as ProfessionalRequest);
        setStep(3);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Nao foi possivel enviar.",
        );
      }
    });
  }

  if (step === "status") {
    return (
      <div className="pb-16">
        <PageHeader title="Modo profissional" backHref="/perfil/definicoes" />
        <StatusStep
          status={status}
          request={request}
          onRetry={() => {
            setNome("");
            setTipo("");
            setTipoDetalhe("");
            setDescricao("");
            setContacto("");
            setError(null);
            setRequest(null);
            setStep(1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="pb-16">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-1 border-b border-[var(--separator)] bg-[var(--elevated)] px-2 backdrop-blur-xl">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => {
            if (step === 1) router.push("/perfil/definicoes");
            else if (step === 3) router.push("/perfil/definicoes");
            else {
              setError(null);
              setStep((step - 1) as Step);
            }
          }}
          className="rounded-full p-2.5 text-foreground/80 hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <p className="flex-1 text-center text-[15px] font-semibold tracking-[-0.02em]">
          {step === 3 ? "Concluido" : `Passo ${step} de 3`}
        </p>
        <span className="w-10" />
      </header>

      {step === 1 && <IntroStep onContinue={() => setStep(2)} />}
      {step === 2 && (
        <FormStep
          nome={nome}
          tipo={tipo}
          tipoDetalhe={tipoDetalhe}
          descricao={descricao}
          contacto={contacto}
          error={error}
          loading={pending}
          onNome={setNome}
          onTipo={(v) => {
            setTipo(v);
            if (v !== "outro") setTipoDetalhe("");
          }}
          onTipoDetalhe={setTipoDetalhe}
          onDescricao={setDescricao}
          onContacto={setContacto}
          onSubmit={submit}
        />
      )}
      {step === 3 && (
        <DoneStep onClose={() => router.push("/perfil/definicoes")} />
      )}
    </div>
  );
}

function IntroStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="px-5 pt-8">
      <div className="flex flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[18px] bg-card">
          <Building2
            className="h-8 w-8 text-foreground/90"
            strokeWidth={1.5}
            aria-hidden
          />
        </div>
        <h1 className="text-[22px] font-semibold tracking-[-0.03em]">
          Modo profissional
        </h1>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
          Conta de organizacao na rede — com destaque no feed.
        </p>
      </div>

      <ul className="mt-8 space-y-4">
        <IntroPoint
          icon={Megaphone}
          title="O que muda"
          body="Selo de organizacao e possibilidade de destacar publicacoes no feed."
        />
        <IntroPoint
          icon={Building2}
          title="Beneficios"
          body="Alcance garantido em publicacoes destacadas e presenca como pagina institucional."
        />
        <IntroPoint
          icon={ShieldAlert}
          title="Responsabilidades"
          body="Maximo 3 destaques por semana. Conteudo deve representar a organizacao. Uso indevido pode remover o estatuto."
        />
      </ul>

      <button
        type="button"
        onClick={onContinue}
        className="mt-10 flex h-12 w-full items-center justify-center rounded-full bg-accent text-[15px] font-semibold tracking-[-0.02em] text-accent-foreground"
      >
        Continuar
      </button>
    </div>
  );
}

function IntroPoint({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Building2;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"
        aria-hidden
      >
        <Icon className="h-4 w-4 text-foreground/85" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold tracking-[-0.02em]">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </li>
  );
}

function FormStep({
  nome,
  tipo,
  tipoDetalhe,
  descricao,
  contacto,
  error,
  loading,
  onNome,
  onTipo,
  onTipoDetalhe,
  onDescricao,
  onContacto,
  onSubmit,
}: {
  nome: string;
  tipo: ProfessionalOrgType | "";
  tipoDetalhe: string;
  descricao: string;
  contacto: string;
  error: string | null;
  loading: boolean;
  onNome: (v: string) => void;
  onTipo: (v: ProfessionalOrgType | "") => void;
  onTipoDetalhe: (v: string) => void;
  onDescricao: (v: string) => void;
  onContacto: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="space-y-5 px-5 pt-8"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h1 className="text-[22px] font-semibold tracking-[-0.03em]">Pedido</h1>
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Dados da organizacao para revisao manual.
      </p>

      <Field label="Nome oficial">
        <input
          value={nome}
          onChange={(e) => onNome(e.target.value)}
          maxLength={120}
          autoComplete="organization"
          className={fieldClass}
          placeholder="Nome da organizacao"
        />
      </Field>

      <Field label="Tipo">
        <select
          value={tipo}
          onChange={(e) =>
            onTipo((e.target.value || "") as ProfessionalOrgType | "")
          }
          className={cn(fieldClass, "appearance-none")}
        >
          <option value="">Seleccionar</option>
          {ORG_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      {tipo === "outro" ? (
        <Field label="Especifica">
          <input
            value={tipoDetalhe}
            onChange={(e) => onTipoDetalhe(e.target.value.slice(0, 80))}
            maxLength={80}
            className={fieldClass}
            placeholder="Tipo de organizacao"
            autoFocus
          />
        </Field>
      ) : null}

      <Field label="Descricao">
        <textarea
          value={descricao}
          onChange={(e) => onDescricao(e.target.value.slice(0, 200))}
          maxLength={200}
          rows={3}
          className={cn(fieldClass, "min-h-[88px] resize-none py-3")}
          placeholder="O que a organizacao representa"
        />
        <p
          className={cn(
            "mt-1 text-right text-[12px] text-muted-foreground",
            descricao.length > 180 && "text-[#ff3b30]",
          )}
        >
          {descricao.length}/200
        </p>
      </Field>

      <Field label="Contacto de verificacao">
        <input
          value={contacto}
          onChange={(e) => onContacto(e.target.value)}
          maxLength={200}
          autoComplete="email"
          className={fieldClass}
          placeholder="Email, site ou pagina oficial"
        />
      </Field>

      {error && (
        <p className="text-[13px] text-[#ff3b30]" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center rounded-full bg-accent text-[15px] font-semibold tracking-[-0.02em] text-accent-foreground disabled:opacity-50"
      >
        {loading ? "A enviar..." : "Enviar pedido"}
      </button>
    </form>
  );
}

function DoneStep({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center px-5 pt-14 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-card">
        <Check className="h-7 w-7 text-foreground" strokeWidth={2} aria-hidden />
      </div>
      <h1 className="text-[22px] font-semibold tracking-[-0.03em]">
        Pedido enviado
      </h1>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
        O estado fica visivel nas definicoes. Sem prazo fixo de revisao.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-10 flex h-12 w-full items-center justify-center rounded-full bg-accent text-[15px] font-semibold tracking-[-0.02em] text-accent-foreground"
      >
        Concluir
      </button>
    </div>
  );
}

function StatusStep({
  status,
  request,
  onRetry,
}: {
  status: ProfessionalRequestStatus | "active" | null;
  request: ProfessionalRequest | null;
  onRetry: () => void;
}) {
  if (status === "active" || status === "approved") {
    return (
      <StatusBlock
        icon={Check}
        title="Modo profissional activo"
        body="A conta tem estatuto de organizacao e pode destacar publicacoes."
      />
    );
  }

  if (status === "pending") {
    return (
      <StatusBlock
        icon={Clock}
        title="Pedido em analise"
        body={
          request?.nome_organizacao
            ? `${request.nome_organizacao} — aguarda decisao.`
            : "O pedido esta a ser analisado."
        }
      />
    );
  }

  if (status === "rejected") {
    return (
      <div>
        <StatusBlock
          icon={XCircle}
          title="Pedido recusado"
          body="Nao foi possivel activar o modo profissional com este pedido."
        />
        <div className="px-5 pt-6">
          <button
            type="button"
            onClick={onRetry}
            className="flex h-12 w-full items-center justify-center rounded-full bg-accent text-[15px] font-semibold tracking-[-0.02em] text-accent-foreground"
          >
            Novo pedido
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function StatusBlock({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Clock;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center px-5 pt-14 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-card">
        <Icon className="h-7 w-7 text-foreground" strokeWidth={1.75} aria-hidden />
      </div>
      <h1 className="text-[20px] font-semibold tracking-[-0.03em]">{title}</h1>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

const fieldClass =
  "h-12 w-full rounded-[12px] border-0 bg-card px-3.5 text-[16px] outline-none ring-1 ring-[var(--separator)] placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/20";

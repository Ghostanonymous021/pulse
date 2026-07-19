import {
  Ban,
  Building2,
  Download,
  FileText,
  HelpCircle,
  Info,
  KeyRound,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  ScrollText,
  BadgeCheck,
  Shield,
  Smartphone,
  Trash2,
  User,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/nav/page-header";
import { NotificationToggles } from "@/components/settings/notification-toggles";
import { PushToggle } from "@/components/notifications/push-toggle";
import { PrivacySwitch } from "@/components/settings/privacy-switch";
import { SettingsGroup } from "@/components/settings/settings-group";
import { SettingsRow } from "@/components/settings/settings-row";
import { SignOutAllRow } from "@/components/settings/sign-out-all-row";
import { SignOutRow } from "@/components/settings/sign-out-row";
import { isSyntheticPhoneEmail } from "@/lib/auth/phone";
import { requireProfile } from "@/lib/auth/session";
import { getLatestProfessionalRequest } from "@/lib/settings/professional";
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  type DmPermission,
} from "@/lib/settings/prefs";
import { isVerificationActive } from "@/lib/settings/verification";
import packageJson from "../../../../../package.json";

export const metadata = {
  title: "Definicoes",
};

const DM_LABEL: Record<DmPermission, string> = {
  everyone: "Todos",
  following: "So quem sigo",
  none: "Ninguém novo",
};

/**
 * Apple Settings–style hub.
 * Groups only — never a flat list. Real Supabase data (no mock).
 *
 * Conta extras (modo profissional + selo) are product surfaces from
 * PULSE_VISAO / AGENTS — entry points live here, not separate chrome.
 */
export default async function DefinicoesPage() {
  const { supabase, profile } = await requireProfile();

  const recoveryEmail =
    profile.email && !isSyntheticPhoneEmail(profile.email)
      ? profile.email
      : null;

  const dmPermission = (profile.dm_permission ??
    "everyone") as DmPermission;

  let notifPrefs;
  try {
    notifPrefs = await getNotificationPrefs(supabase, profile.id);
  } catch {
    notifPrefs = { user_id: profile.id, ...DEFAULT_NOTIFICATION_PREFS };
  }

  const proRequest = await getLatestProfessionalRequest(supabase, profile.id);
  const isOrg = profile.account_type === "organizacao";
  const verified = isVerificationActive(profile);

  const verificationLabel = "Selo de verificação";
  const verificationValue = verified ? "Activo" : "Em breve";

  const proLabel = (() => {
    if (isOrg) return "Modo profissional";
    if (proRequest?.status === "pending") return "Pedido em analise";
    if (proRequest?.status === "rejected") return "Pedido recusado";
    return "Ativar modo profissional";
  })();
  const proValue = isOrg
    ? "Activo"
    : proRequest?.status === "rejected"
      ? "Ver"
      : undefined;

  const version = packageJson.version ?? "0.1.0";

  return (
    <div className="pb-16">
      <PageHeader title="Definicoes" backHref="/perfil" />

      <div className="space-y-7 pt-5">
        {/* —— Conta —— */}
        <SettingsGroup title="Conta">
          <SettingsRow
            icon={User}
            label="Editar perfil"
            href="/perfil/editar?from=definicoes"
          />
          <SettingsRow
            icon={Mail}
            label="E-mail de recuperacao"
            href="/perfil/definicoes/email"
            value={recoveryEmail ?? "Adicionar"}
          />
          <SettingsRow
            icon={Phone}
            label="Número de telefone"
            value={profile.phone || "—"}
          />
          <SettingsRow
            icon={KeyRound}
            label="Alterar senha"
            href="/perfil/definicoes/senha"
          />
          <SettingsRow
            icon={Building2}
            label={proLabel}
            href="/perfil/definicoes/profissional"
            value={proValue}
          />
          <SettingsRow
            icon={BadgeCheck}
            label={verificationLabel}
            href="/perfil/definicoes/verificacao"
            value={verificationValue}
          />
        </SettingsGroup>

        {/* —— Privacidade —— */}
        <SettingsGroup title="Privacidade">
          <SettingsRow
            icon={Lock}
            label="Conta privada"
            control={<PrivacySwitch initialPrivate={profile.is_private} />}
          />
          <SettingsRow
            icon={MessageSquare}
            label="Quem pode enviar mensagem"
            href="/perfil/definicoes/mensagens"
            value={DM_LABEL[dmPermission] ?? "Todos"}
          />
          <SettingsRow
            icon={Ban}
            label="Contas bloqueadas"
            href="/perfil/definicoes/bloqueados"
          />
          <SettingsRow
            icon={Users}
            label="Seguidores e a seguir"
            href="/perfil/definicoes/conexoes"
          />
        </SettingsGroup>

        {/* —— Notificações (toggles individuais) —— */}
        <PushToggle />
        <NotificationToggles initial={notifPrefs} title="Notificações" />

        {/* —— Segurança —— */}
        <SettingsGroup title="Segurança">
          <SettingsRow
            icon={Smartphone}
            label="Sessões activas"
            href="/perfil/definicoes/sessoes"
          />
          <SignOutRow />
          <SignOutAllRow />
          <SettingsRow
            icon={Shield}
            label="Historico de denuncias"
            href="/perfil/definicoes/denuncias"
          />
        </SettingsGroup>

        {/* —— Conteudo e dados —— */}
        <SettingsGroup title="Conteúdo e dados">
          <SettingsRow
            icon={Download}
            label="Descarregar os meus dados"
            href="/perfil/definicoes/dados"
          />
          <SettingsRow
            icon={Trash2}
            label="Apagar conta"
            href="/perfil/definicoes/apagar-conta"
            destructive
          />
        </SettingsGroup>

        {/* —— Sobre —— */}
        <SettingsGroup title="Sobre">
          <SettingsRow icon={Info} label="Versao" value={version} />
          <SettingsRow
            icon={ScrollText}
            label="Termos de uso"
            href="/perfil/definicoes/termos"
          />
          <SettingsRow
            icon={FileText}
            label="Politica de privacidade"
            href="/perfil/definicoes/privacidade"
          />
          <SettingsRow
            icon={HelpCircle}
            label="Ajuda e suporte"
            href="/perfil/definicoes/ajuda"
          />
        </SettingsGroup>
      </div>
    </div>
  );
}

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AccountType } from "@/types/database";

/** First month promo (MZN). */
export const VERIFICATION_PRICE_FIRST_MZN = 60;
/** Recurring monthly (MZN) from month 2. */
export const VERIFICATION_PRICE_RENEWAL_MZN = 150;

export type VerificationRequestStatus =
  | "draft"
  | "pending_payment"
  | "pending_review"
  | "active"
  | "rejected"
  | "expired"
  | "cancelled";

export type VerificationPaymentStatus =
  | "pending"
  | "simulated"
  | "paid"
  | "failed"
  | "refunded";

export type VerificationRequest = {
  id: string;
  profile_id: string;
  account_type: AccountType;
  status: VerificationRequestStatus;
  id_document_path: string | null;
  selfie_path: string | null;
  org_document_path: string | null;
  org_email_domain: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  activated_at: string | null;
};

export type VerificationPayment = {
  id: string;
  request_id: string;
  profile_id: string;
  amount_mzn: number;
  currency: string;
  is_first_month: boolean;
  provider: string;
  provider_ref: string | null;
  status: VerificationPaymentStatus;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  paid_at: string | null;
};

export function isVerificationActive(profile: {
  is_verified?: boolean | null;
  verification_expires_at?: string | null;
}) {
  if (!profile.is_verified) return false;
  if (!profile.verification_expires_at) return true;
  return new Date(profile.verification_expires_at).getTime() > Date.now();
}

/** Badge flavour: verified_type at activation, else current account_type. */
export function verificationBadgeType(profile: {
  verified_type?: AccountType | null;
  account_type?: AccountType | null;
}): AccountType {
  if (profile.verified_type === "pessoa" || profile.verified_type === "organizacao") {
    return profile.verified_type;
  }
  return profile.account_type === "organizacao" ? "organizacao" : "pessoa";
}

export function priceForCheckout(hasPaidBefore: boolean) {
  return hasPaidBefore
    ? VERIFICATION_PRICE_RENEWAL_MZN
    : VERIFICATION_PRICE_FIRST_MZN;
}

export async function getLatestVerificationRequest(
  supabase: SupabaseClient,
  profileId: string,
): Promise<VerificationRequest | null> {
  const { data, error } = await supabase
    .from("verification_requests")
    .select(
      "id, profile_id, account_type, status, id_document_path, selfie_path, org_document_path, org_email_domain, admin_notes, created_at, updated_at, reviewed_at, activated_at",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getLatestVerificationRequest", error.message);
    return null;
  }
  return (data as VerificationRequest | null) ?? null;
}

export async function hasPriorVerificationPayment(
  supabase: SupabaseClient,
  profileId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("verification_payments")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .in("status", ["paid", "simulated"]);

  if (error) {
    console.error("hasPriorVerificationPayment", error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

export async function listProfileAdmins(
  supabase: SupabaseClient,
  profileId: string,
) {
  const { data, error } = await supabase
    .from("profile_admins")
    .select(
      `
      admin_user_id,
      role,
      created_at,
      admin:profiles!profile_admins_admin_user_id_fkey (
        id, username, display_name, avatar_url
      )
    `,
    )
    .eq("profile_id", profileId);

  if (error) {
    console.error("listProfileAdmins", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const admin = Array.isArray(row.admin) ? row.admin[0] : row.admin;
    return {
      admin_user_id: row.admin_user_id as string,
      role: row.role as "owner" | "admin",
      created_at: row.created_at as string,
      admin: admin as {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
      } | null,
    };
  });
}

export type Benefit = {
  title: string;
  detail: string;
};

export function benefitsForAccountType(accountType: AccountType): Benefit[] {
  const base: Benefit[] = [
    {
      title: "Selo no perfil",
      detail: "Badge visivel junto ao nome em todo o Pulse.",
    },
    {
      title: "Protecao contra impersonacao",
      detail: "Em disputa de identidade, a conta verificada tem prioridade.",
    },
    {
      title: "Destaque no Explorar",
      detail: "Mais visibilidade na descoberta — nunca no feed principal.",
    },
    {
      title: "Suporte prioritario",
      detail: "Denuncias e pedidos teus sobem na fila interna.",
    },
    {
      title: "Acesso antecipado",
      detail: "Funcionalidades novas antes do lancamento geral.",
    },
  ];

  if (accountType === "organizacao") {
    return [
      ...base,
      {
        title: "Badge institucional",
        detail: "Forma distinta do check pessoal — clareza oficial.",
      },
      {
        title: "Mais destaques semanais",
        detail: "Limite de 3 para 6 publicacoes destacadas por semana.",
      },
      {
        title: "Estatisticas basicas",
        detail: "Visualizacoes do perfil e alcance agregado dos posts.",
      },
      {
        title: "Varios administradores",
        detail: "Equipa com acesso a mesma conta da organizacao.",
      },
    ];
  }

  return base;
}

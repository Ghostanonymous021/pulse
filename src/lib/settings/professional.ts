import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfessionalOrgType =
  | "universidade"
  | "instituicao"
  | "empresa"
  | "clube"
  | "outro";

export type ProfessionalRequestStatus = "pending" | "approved" | "rejected";

export type ProfessionalRequest = {
  id: string;
  profile_id: string;
  nome_organizacao: string;
  tipo_organizacao: ProfessionalOrgType;
  /** Required when tipo_organizacao = outro */
  tipo_detalhe: string | null;
  descricao: string;
  contacto: string;
  status: ProfessionalRequestStatus;
  created_at: string;
  reviewed_at: string | null;
};

export const ORG_TYPE_OPTIONS: {
  value: ProfessionalOrgType;
  label: string;
}[] = [
  { value: "universidade", label: "Universidade" },
  { value: "instituicao", label: "Instituicao" },
  { value: "empresa", label: "Empresa" },
  { value: "clube", label: "Clube ou associacao estudantil" },
  { value: "outro", label: "Outro" },
];

/** Latest request for this profile (any status). */
export async function getLatestProfessionalRequest(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ProfessionalRequest | null> {
  const { data, error } = await supabase
    .from("professional_requests")
    .select(
      "id, profile_id, nome_organizacao, tipo_organizacao, tipo_detalhe, descricao, contacto, status, created_at, reviewed_at",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProfessionalRequest;
}

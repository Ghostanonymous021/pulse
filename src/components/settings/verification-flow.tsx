"use client";

import { BadgeCheck } from "lucide-react";

import { PageHeader } from "@/components/nav/page-header";
import { VerifiedBadge } from "@/components/social/verified-badge";
import {
  isVerificationActive,
  verificationBadgeType,
} from "@/lib/settings/verification";
import type { Profile } from "@/types/database";

/**
 * Verification self-serve is intentionally deferred.
 * Seals are applied manually in Supabase (profiles.is_verified) for now.
 */
export function VerificationFlow({ profile }: { profile: Profile }) {
  const active = isVerificationActive(profile);
  const badgeType = verificationBadgeType(profile);

  return (
    <div className="pb-16">
      <PageHeader title="Verificacao" backHref="/perfil/definicoes" />

      <div className="flex flex-col items-center px-6 pt-14 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          {active ? (
            <VerifiedBadge accountType={badgeType} size="lg" />
          ) : (
            <BadgeCheck
              className="h-8 w-8 text-foreground/70"
              strokeWidth={1.5}
              aria-hidden
            />
          )}
        </div>

        {active ? (
          <>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">
              Conta verificada
            </h1>
            <p className="mt-2 max-w-[280px] text-[15px] leading-snug text-muted-foreground">
              O teu selo esta activo. Gerido pela equipa Pulse.
            </p>
            <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-1.5 text-[13px] font-medium text-foreground/80">
              <VerifiedBadge accountType={badgeType} size="sm" />
              Activo
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">
              Selo de verificacao
            </h1>
            <p className="mt-2 max-w-[280px] text-[15px] leading-snug text-muted-foreground">
              Em breve. Por agora, a verificacao e feita apenas pela equipa.
            </p>
            <div className="mt-6 rounded-full bg-muted px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground">
              Em breve
            </div>
          </>
        )}
      </div>
    </div>
  );
}

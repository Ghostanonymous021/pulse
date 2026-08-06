import Link from "next/link";
import { redirect } from "next/navigation";

import { PulseWordmark } from "@/components/brand/pulse-wordmark";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/home");
    }
  }

  return (
    <div
      data-app-chrome
      className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-between px-6 py-16"
    >
      <div className="space-y-5 pt-12">
        <PulseWordmark className="h-8 w-auto text-foreground" />
        <h1 className="text-3xl font-semibold tracking-tight">
          Pessoas, ideias e conversas que valem a pena
        </h1>
        <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
          O teu espaco para partilhar, descobrir talento e construir a tua rede. Sem ruido.
        </p>
      </div>

      <div className="flex flex-col gap-3 pb-8">
        <Link
          href="/signup"
          className="flex h-12 items-center justify-center rounded-xl bg-brand text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
        >
          Criar conta
        </Link>
        <Link
          href="/login"
          className="flex h-12 items-center justify-center rounded-xl border border-border text-sm font-medium transition-colors hover:bg-muted"
        >
          Entrar
        </Link>
      </div>
    </div>
  );
}

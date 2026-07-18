import Link from "next/link";
import { redirect } from "next/navigation";

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
      <div className="space-y-3 pt-12">
        <p className="text-sm font-medium text-muted-foreground">Pulse</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          A camada social das universidades
        </h1>
        <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
          Colegas, campus, oportunidades e talento — num so lugar. Sem ruido
          institucional.
        </p>
      </div>

      <div className="flex flex-col gap-3 pb-8">
        <Link
          href="/signup"
          className="flex h-12 items-center justify-center rounded-xl bg-accent text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
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

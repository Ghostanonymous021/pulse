import { NextResponse } from "next/server";

import { isSyntheticPhoneEmail, phoneToAuthEmail } from "@/lib/auth/phone";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security/client-ip";
import { securityLog } from "@/lib/security/log";
import { assertSameOrigin } from "@/lib/security/origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Permanent account delete.
 * Requires: session + confirm phrase + current password (step-up).
 */
export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    securityLog("origin_rejected", { route: "delete-account" });
    return NextResponse.json(
      { error: origin.error },
      { status: origin.status },
    );
  }

  const ip = clientIp(request);
  const limited = rateLimit(`delete-account:${ip}`, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Demasiadas tentativas." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  let body: { confirm?: string; password?: string } = {};
  try {
    body = (await request.json()) as { confirm?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
  }

  if (body.confirm?.trim().toLowerCase() !== "apagar") {
    return NextResponse.json(
      { error: "Confirmacao incorrecta." },
      { status: 400 },
    );
  }

  const password = body.password ?? "";
  if (!password) {
    return NextResponse.json(
      { error: "Indica a tua senha para confirmar." },
      { status: 400 },
    );
  }

  // Resolve auth email (phone-first accounts use synthetic email)
  let authEmail = user.email ?? null;
  if (!authEmail || isSyntheticPhoneEmail(authEmail)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.phone) {
      authEmail = phoneToAuthEmail(profile.phone);
    }
  }
  if (!authEmail) {
    return NextResponse.json(
      { error: "Conta sem identificador de login." },
      { status: 400 },
    );
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password,
  });
  if (reauthError) {
    securityLog("delete_account_bad_password", { user_id: user.id });
    return NextResponse.json(
      { error: "Senha incorrecta." },
      { status: 403 },
    );
  }

  try {
    const admin = createAdminClient();
    await admin.from("profiles").delete().eq("id", user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      securityLog("delete_account_failed", {
        user_id: user.id,
        reason: error.message.slice(0, 80),
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.auth.signOut({ scope: "global" });
    securityLog("delete_account_ok", { user_id: user.id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    securityLog("delete_account_failed", {
      user_id: user.id,
      reason: err instanceof Error ? err.message.slice(0, 80) : "unknown",
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Falha ao apagar a conta.",
      },
      { status: 500 },
    );
  }
}

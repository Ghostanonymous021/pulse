import { NextResponse } from "next/server";

import {
  looksLikeEmail,
  looksLikePhone,
  normalizePhone,
  phoneToAuthEmail,
} from "@/lib/auth/phone";
import {
  isValidUsername,
  sanitizeUsernameInput,
  suggestUsernameFromName,
} from "@/lib/auth/username";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security/client-ip";
import { securityLog } from "@/lib/security/log";
import { assertSameOrigin } from "@/lib/security/origin";
import { validatePassword } from "@/lib/security/password";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = {
  identifier?: string;
  password?: string;
  display_name?: string;
  username?: string;
};

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    securityLog("origin_rejected", { route: "signup" });
    return NextResponse.json(
      { error: origin.error },
      { status: origin.status },
    );
  }

  const ip = clientIp(request);

  const limited = rateLimit(`signup:${ip}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    securityLog("signup_rate_limited", { ip });
    return NextResponse.json(
      { error: "Demasiadas tentativas. Tenta mais tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
  }

  const identifier = (body.identifier ?? "").trim();
  const password = body.password ?? "";
  const displayName = (body.display_name ?? "").trim();

  if (!identifier) {
    return NextResponse.json(
      { error: "Preenche os campos obrigatorios." },
      { status: 400 },
    );
  }

  const pwErr = validatePassword(password);
  if (pwErr) {
    return NextResponse.json({ error: pwErr }, { status: 400 });
  }

  const isPhone = looksLikePhone(identifier);
  const isEmail = looksLikeEmail(identifier);

  if (!isPhone && !isEmail) {
    return NextResponse.json(
      { error: "Usa um telefone ou e-mail valido." },
      { status: 400 },
    );
  }

  const phone = isPhone ? normalizePhone(identifier) : null;
  const email = isEmail ? identifier.toLowerCase() : phoneToAuthEmail(phone!);

  let username = sanitizeUsernameInput(body.username ?? "");
  if (!username) {
    username = suggestUsernameFromName(
      displayName || (isPhone ? phone! : identifier.split("@")[0]),
    );
  }
  if (!isValidUsername(username)) {
    return NextResponse.json(
      {
        error:
          "Username invalido. Usa 3–30 caracteres: a-z, 0-9, ponto ou underscore.",
      },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();

    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .limit(1)
      .maybeSingle();

    if (taken) {
      return NextResponse.json(
        { error: "Esse username ja está em uso." },
        { status: 409 },
      );
    }

    // Verificar limite de 6 contas por telefone
    if (phone) {
      const { data: existingAccounts } = await admin
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .limit(10);

      if (existingAccounts && existingAccounts.length >= 6) {
        securityLog("signup_failed", { reason: "max_accounts_per_phone" });
        return NextResponse.json(
          { error: "Este número já tem o máximo de 6 contas permitidas." },
          { status: 409 },
        );
      }
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName || username,
        username,
        phone: phone ?? undefined,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        securityLog("signup_failed", { reason: "already_registered" });
        return NextResponse.json(
          { error: "Ja existe uma conta com estes dados." },
          { status: 409 },
        );
      }
      securityLog("signup_failed", { reason: error.message.slice(0, 80) });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data.user && phone) {
      await admin.from("profiles").update({ phone }).eq("id", data.user.id);
    }

    if (data.user) {
      await admin
        .from("profiles")
        .update({
          username,
          display_name: displayName || username,
        })
        .eq("id", data.user.id);
    }

    securityLog("signup_ok", {
      user_id: data.user?.id ?? null,
      kind: isPhone ? "phone" : "email",
    });

    return NextResponse.json({
      ok: true,
      login: isPhone
        ? { kind: "phone" as const, phone }
        : { kind: "email" as const, email },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Não foi possível criar a conta.";
    securityLog("signup_failed", { reason: message.slice(0, 80) });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

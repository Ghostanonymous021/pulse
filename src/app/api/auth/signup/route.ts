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

const PHONE_ACCOUNT_LIMIT_MESSAGE =
  "Esse numero ja tem o maximo de contas Pulse permitidas. Usa outro numero ou entra numa das contas existentes.";

type Body = {
  identifier?: string;
  password?: string;
  display_name?: string;
  username?: string;
};

type CreateAuthUserInput = {
  email: string;
  password: string;
  display_name: string;
  username: string;
  phone: string | null;
};

type CreateAuthUserResult =
  | { ok: true; user: { id: string } }
  | {
      ok: false;
      reason: "phone_limit" | "already_registered" | "other";
      message: string;
    };

/**
 * Cria o utilizador via Admin REST API directamente (fetch), em vez do
 * SDK supabase-js: o SDK descarta o corpo de erros 500 do Admin API
 * (fica `{}`), o que impede distinguir o erro de negocio
 * PHONE_ACCOUNT_LIMIT_REACHED (levantado pelo trigger `handle_new_user`,
 * errcode P0001) de qualquer outra falha 500. A API REST devolve o corpo
 * completo `{ code, message }` do Postgres.
 */
async function createAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  input: CreateAuthUserInput,
): Promise<CreateAuthUserResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        display_name: input.display_name,
        username: input.username,
        phone: input.phone ?? undefined,
      },
    }),
  });

  if (res.ok) {
    const data = (await res.json()) as { id?: string };
    if (!data.id) {
      return { ok: false, reason: "other", message: "Resposta invalida do servico de autenticacao." };
    }
    return { ok: true, user: { id: data.id } };
  }

  let body: { code?: string; message?: string; error_code?: string; msg?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // sem corpo JSON — segue para o fallback generico abaixo
  }

  const message = body.message || body.msg || "Nao foi possivel criar a conta.";

  if (body.code === "P0001" && message.includes("PHONE_ACCOUNT_LIMIT_REACHED")) {
    return { ok: false, reason: "phone_limit", message };
  }

  const lower = message.toLowerCase();
  if (
    body.error_code === "email_exists" ||
    lower.includes("already") ||
    lower.includes("registered")
  ) {
    return { ok: false, reason: "already_registered", message };
  }

  return { ok: false, reason: "other", message };
}

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

    // Nota: o SDK supabase-js engole o corpo de erros 500 do Admin API
    // (fica so `{}`), incluindo a rejeicao vinda do trigger `handle_new_user`
    // (limite de contas por telefone, errcode P0001). Usamos fetch direto
    // para este passo, para conseguirmos distinguir esse caso especifico
    // do utilizador e devolver uma mensagem util em vez de um erro generico.
    const created = await createAuthUser(admin, {
      email,
      password,
      display_name: displayName || username,
      username,
      phone,
    });

    if (!created.ok) {
      if (created.reason === "phone_limit") {
        securityLog("signup_phone_limit_reached", {
          phone_suffix: phone ? phone.slice(-4) : null,
        });
        return NextResponse.json(
          { error: PHONE_ACCOUNT_LIMIT_MESSAGE },
          { status: 409 },
        );
      }
      if (created.reason === "already_registered") {
        securityLog("signup_failed", { reason: "already_registered" });
        return NextResponse.json(
          { error: "Ja existe uma conta com estes dados." },
          { status: 409 },
        );
      }
      securityLog("signup_failed", { reason: created.message.slice(0, 80) });
      return NextResponse.json({ error: created.message }, { status: 400 });
    }

    const data = { user: created.user };

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

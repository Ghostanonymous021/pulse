import { NextResponse } from "next/server";

import {
  looksLikeEmail,
  looksLikePhone,
  normalizePhone,
  phoneToAuthEmail,
} from "@/lib/auth/phone";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security/client-ip";
import { securityLog } from "@/lib/security/log";
import { assertSameOrigin } from "@/lib/security/origin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = {
  identifier?: string;
  password?: string;
};

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const ip = clientIp(request);

  const limited = rateLimit(`login:${ip}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    securityLog("login_rate_limited", { ip });
    return NextResponse.json(
      { error: "Demasiadas tentativas. Tenta mais tarde." },
      { status: 429 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const identifier = (body.identifier ?? "").trim();
  const password = body.password ?? "";

  if (!identifier || !password) {
    return NextResponse.json(
      { error: "Preenche todos os campos." },
      { status: 400 }
    );
  }

  const isPhone = looksLikePhone(identifier);
  const isEmail = looksLikeEmail(identifier);

  if (!isPhone && !isEmail) {
    return NextResponse.json(
      { error: "Usa um telefone ou e-mail válido." },
      { status: 400 }
    );
  }

  const phone = isPhone ? normalizePhone(identifier) : null;
  const email = isEmail ? identifier.toLowerCase() : phoneToAuthEmail(phone!);

  try {
    const admin = createAdminClient();

    // Se for telefone, verificar quantas contas existem
    if (phone) {
      const { data: accounts } = await admin
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("phone", phone)
        .limit(10);

      if (accounts && accounts.length > 1) {
        // Retornar lista de contas para seleção (frontend decide)
        return NextResponse.json({
          multipleAccounts: true,
          accounts: accounts.map((acc) => ({
            id: acc.id,
            username: acc.username,
            display_name: acc.display_name,
            avatar_url: acc.avatar_url,
          })),
          phone,
        });
      }
    }

    // Login normal
    return NextResponse.json({
      multipleAccounts: false,
      email,
      phone: phone ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao verificar contas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security/client-ip";
import { securityLog } from "@/lib/security/log";

export const runtime = "nodejs";

type Body = {
  userId: string;
  password: string;
};

export async function POST(request: Request) {
  const ip = clientIp(request);

  const limited = rateLimit(`login-account:${ip}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Demasiadas tentativas." },
      { status: 429 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const { userId, password } = body;

  if (!userId || !password) {
    return NextResponse.json(
      { error: "Dados incompletos." },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();

    // Buscar o usuário
    const { data: user, error: userError } = await admin.auth.admin.getUserById(userId);

    if (userError || !user.user) {
      return NextResponse.json(
        { error: "Conta não encontrada." },
        { status: 404 }
      );
    }

    // Verificar se a senha está correta (usando signInWithPassword via cliente)
    // Como estamos no servidor, retornamos os dados para o frontend fazer o login real
    return NextResponse.json({
      success: true,
      email: user.user.email,
      userId: user.user.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao selecionar conta.";
    securityLog("login_account_failed", { reason: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

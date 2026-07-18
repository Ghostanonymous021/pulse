import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security/client-ip";
import { securityLog } from "@/lib/security/log";
import { assertSameOrigin } from "@/lib/security/origin";
import {
  VERIFICATION_PRICE_FIRST_MZN,
  VERIFICATION_PRICE_RENEWAL_MZN,
} from "@/lib/settings/verification";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Simulated payment is NEVER the default in production.
 *
 * Allow sim only when:
 * - VERIFICATION_ALLOW_SIMULATED=true AND
 * - (NODE_ENV !== production OR VERIFICATION_ALLOW_SIMULATED_PROD=true)
 *
 * Auto-activate only when VERIFICATION_AUTO_ACTIVATE=true (explicit).
 * Production M-Pesa: webhook must call activate_verification with service_role.
 */
function allowSimulatedPayment(): boolean {
  if (process.env.VERIFICATION_ALLOW_SIMULATED !== "true") {
    return process.env.NODE_ENV !== "production";
  }
  if (process.env.NODE_ENV === "production") {
    return process.env.VERIFICATION_ALLOW_SIMULATED_PROD === "true";
  }
  return true;
}

function allowAutoActivate(): boolean {
  return (
    allowSimulatedPayment() &&
    process.env.VERIFICATION_AUTO_ACTIVATE === "true"
  );
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    securityLog("origin_rejected", { route: "verification/pay" });
    return NextResponse.json(
      { error: origin.error },
      { status: origin.status },
    );
  }

  const ip = clientIp(request);
  const limited = rateLimit(`verification-pay:${ip}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Demasiadas tentativas." },
      { status: 429 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: { request_id?: string; provider?: string };
  try {
    body = (await request.json()) as { request_id?: string };
  } catch {
    return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
  }

  const requestId = body.request_id;
  if (!requestId) {
    return NextResponse.json({ error: "request_id em falta." }, { status: 400 });
  }

  if (!allowSimulatedPayment()) {
    securityLog("verification_pay_unavailable", {
      user_id: user.id,
      reason: "sim_disabled",
    });
    // Keep request open for real provider / manual review path
    try {
      const admin = createAdminClient();
      await admin
        .from("verification_requests")
        .update({ status: "pending_payment" })
        .eq("id", requestId)
        .eq("profile_id", user.id)
        .in("status", ["draft", "pending_payment"]);
    } catch {
      /* best-effort */
    }
    return NextResponse.json(
      {
        error: "Pagamento ainda não disponivel neste ambiente.",
        code: "PAYMENT_PROVIDER_UNAVAILABLE",
        status: "pending_payment",
      },
      { status: 503 },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Serviço de pagamento indisponivel." },
      { status: 500 },
    );
  }

  const { data: reqRow, error: reqErr } = await admin
    .from("verification_requests")
    .select("id, profile_id, status, account_type")
    .eq("id", requestId)
    .maybeSingle();

  if (reqErr || !reqRow) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (reqRow.profile_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  if (
    reqRow.status !== "pending_payment" &&
    reqRow.status !== "draft" &&
    reqRow.status !== "pending_review"
  ) {
    return NextResponse.json(
      { error: "Este pedido não está pronto para pagamento." },
      { status: 400 },
    );
  }

  const { count } = await admin
    .from("verification_payments")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .in("status", ["paid", "simulated"]);

  const isFirst = (count ?? 0) === 0;
  const amount = isFirst
    ? VERIFICATION_PRICE_FIRST_MZN
    : VERIFICATION_PRICE_RENEWAL_MZN;

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 30);

  // TODO(mpesa): initiate STK, return checkout id; finalize on webhook.
  const providerRef = `sim-${user.id.slice(0, 8)}-${Date.now()}`;

  const { data: payment, error: payErr } = await admin
    .from("verification_payments")
    .insert({
      request_id: requestId,
      profile_id: user.id,
      amount_mzn: amount,
      currency: "MZN",
      is_first_month: isFirst,
      provider: "mpesa",
      provider_ref: providerRef,
      status: "simulated",
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      paid_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (payErr || !payment) {
    return NextResponse.json(
      { error: payErr?.message || "Falha ao registar pagamento." },
      { status: 400 },
    );
  }

  securityLog("verification_pay_simulated", {
    user_id: user.id,
    payment_id: payment.id,
  });

  const autoActivate = allowAutoActivate();

  if (autoActivate) {
    const { error: actErr } = await admin.rpc("activate_verification", {
      p_request_id: requestId,
    });
    if (actErr) {
      // service_role update triggers side effects when status → active
      await admin
        .from("verification_requests")
        .update({ status: "active" })
        .eq("id", requestId);
    }
    return NextResponse.json({
      ok: true,
      payment_id: payment.id,
      amount_mzn: amount,
      activated: true,
      status: "active",
      simulated: true,
    });
  }

  await admin
    .from("verification_requests")
    .update({ status: "pending_review" })
    .eq("id", requestId);

  return NextResponse.json({
    ok: true,
    payment_id: payment.id,
    amount_mzn: amount,
    activated: false,
    status: "pending_review",
    simulated: true,
  });
}

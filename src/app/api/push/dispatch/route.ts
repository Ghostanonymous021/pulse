import { NextResponse } from "next/server";

import { dispatchNotificationPush } from "@/lib/push/fcm";

export const runtime = "nodejs";

/**
 * Fan-out FCM for native devices.
 *
 * Auth options:
 * 1) Header `x-pulse-push-secret` === process.env.PULSE_PUSH_DISPATCH_SECRET
 * 2) Or valid service role is not accepted from clients — secret only.
 *
 * Body (Supabase webhook style or simple):
 * { recipient_id, type, actor_id?, reference_id? }
 * or { record: { ... } } from Database Webhooks
 */
export async function POST(request: Request) {
  const secret = process.env.PULSE_PUSH_DISPATCH_SECRET;
  const header = request.headers.get("x-pulse-push-secret");
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json(
      { error: "FIREBASE_SERVICE_ACCOUNT_JSON not configured" },
      { status: 503 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const record = (body.record as Record<string, unknown> | undefined) ?? body;
  const recipient_id = record.recipient_id as string | undefined;
  const type = record.type as string | undefined;
  if (!recipient_id || !type) {
    return NextResponse.json(
      { error: "recipient_id and type required" },
      { status: 400 },
    );
  }

  try {
    const result = await dispatchNotificationPush({
      recipient_id,
      type,
      actor_id: (record.actor_id as string) ?? null,
      reference_id: (record.reference_id as string) ?? null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("push/dispatch", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "dispatch failed" },
      { status: 500 },
    );
  }
}

/** Optional health: confirms env present (no secrets leaked). */
export async function GET() {
  return NextResponse.json({
    firebaseConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    dispatchSecretConfigured: Boolean(process.env.PULSE_PUSH_DISPATCH_SECRET),
  });
}

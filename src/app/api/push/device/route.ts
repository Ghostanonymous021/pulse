import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Register / refresh a native device push token (FCM).
 * Auth: Bearer session cookie / JWT (Supabase user).
 * Body: { token: string, platform: "android" | "ios" }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: { token?: string; platform?: string } = {};
  try {
    body = (await request.json()) as { token?: string; platform?: string };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const token = body.token?.trim();
  const platform = body.platform?.trim();
  if (!token || !platform || !["android", "ios"].includes(platform)) {
    return NextResponse.json(
      { error: "token e platform (android|ios) são obrigatórios." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("device_push_tokens").upsert(
    {
      profile_id: user.id,
      token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );

  if (error) {
    console.error("push/device POST", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Unregister device token. Body: { token: string } */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: { token?: string } = {};
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "token obrigatório." }, { status: 400 });
  }

  const { error } = await supabase
    .from("device_push_tokens")
    .delete()
    .eq("profile_id", user.id)
    .eq("token", token);

  if (error) {
    console.error("push/device DELETE", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

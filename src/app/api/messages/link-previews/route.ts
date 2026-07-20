import { NextResponse } from "next/server";

import { fetchOpenGraph } from "@/lib/links/preview";
import { extractUrls } from "@/lib/links/urls";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security/client-ip";
import { securityLog } from "@/lib/security/log";
import { assertSameOrigin } from "@/lib/security/origin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Fetch Open Graph once per chat message and cache in
 * message_link_previews. Mirrors /api/posts/link-previews: never
 * called from the thread render path, only right after send.
 */
export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    securityLog("origin_rejected", { route: "message-link-previews" });
    return NextResponse.json(
      { error: origin.error },
      { status: origin.status },
    );
  }

  const ip = clientIp(request);

  const limited = rateLimit(`chat-link-preview:${ip}`, {
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    securityLog("chat_link_preview_rate_limited", { ip });
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

  const userLimited = rateLimit(`chat-link-preview-user:${user.id}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!userLimited.ok) {
    return NextResponse.json(
      { error: "Demasiadas tentativas." },
      { status: 429 },
    );
  }

  let body: { message_id?: string };
  try {
    body = (await request.json()) as { message_id?: string };
  } catch {
    return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
  }

  const messageId = body.message_id;
  if (!messageId) {
    return NextResponse.json(
      { error: "message_id em falta." },
      { status: 400 },
    );
  }

  const { data: message, error: msgErr } = await supabase
    .from("messages")
    .select("id, sender_id, body")
    .eq("id", messageId)
    .maybeSingle();

  if (msgErr || !message) {
    return NextResponse.json(
      { error: "Mensagem não encontrada." },
      { status: 404 },
    );
  }
  if (message.sender_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const urls = extractUrls(message.body as string | null, 1);
  if (!urls.length) {
    return NextResponse.json({ ok: true, previews: [] });
  }

  const url = urls[0];
  try {
    const og = await fetchOpenGraph(url);
    if (!og.titulo && !og.imagem_url) {
      return NextResponse.json({ ok: true, previews: [] });
    }
    const { error: upErr } = await supabase
      .from("message_link_previews")
      .upsert(
        {
          message_id: messageId,
          url,
          titulo: og.titulo,
          imagem_url: og.imagem_url,
          dominio: og.dominio,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "message_id,url" },
      );
    return NextResponse.json({ ok: true, previews: [{ url, ok: !upErr }] });
  } catch {
    return NextResponse.json({ ok: true, previews: [{ url, ok: false }] });
  }
}

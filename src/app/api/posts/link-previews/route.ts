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
 * Fetch Open Graph once at publish time and cache in link_previews.
 * Never called from feed render — compose triggers this after insert.
 */
export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    securityLog("origin_rejected", { route: "link-previews" });
    return NextResponse.json(
      { error: origin.error },
      { status: origin.status },
    );
  }

  const ip = clientIp(request);

  const limited = rateLimit(`link-preview:${ip}`, {
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    securityLog("link_preview_rate_limited", { ip });
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
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  // Per-user cap (abuse isolation even if IP is shared on campus NAT)
  const userLimited = rateLimit(`link-preview-user:${user.id}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!userLimited.ok) {
    return NextResponse.json(
      { error: "Demasiadas tentativas." },
      { status: 429 },
    );
  }

  let body: { post_id?: string };
  try {
    body = (await request.json()) as { post_id?: string };
  } catch {
    return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
  }

  const postId = body.post_id;
  if (!postId) {
    return NextResponse.json({ error: "post_id em falta." }, { status: 400 });
  }

  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, author_id, body")
    .eq("id", postId)
    .maybeSingle();

  if (postErr || !post) {
    return NextResponse.json(
      { error: "Publicacao nao encontrada." },
      { status: 404 },
    );
  }
  if (post.author_id !== user.id) {
    return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
  }

  const urls = extractUrls(post.body as string | null, 2);
  if (!urls.length) {
    return NextResponse.json({ ok: true, previews: [] });
  }

  const saved: { url: string; ok: boolean }[] = [];

  for (const url of urls) {
    try {
      const og = await fetchOpenGraph(url);
      if (!og.titulo && !og.imagem_url) {
        saved.push({ url, ok: false });
        continue;
      }
      const { error: upErr } = await supabase.from("link_previews").upsert(
        {
          post_id: postId,
          url,
          titulo: og.titulo,
          imagem_url: og.imagem_url,
          dominio: og.dominio,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "post_id,url" },
      );
      saved.push({ url, ok: !upErr });
    } catch {
      saved.push({ url, ok: false });
    }
  }

  return NextResponse.json({ ok: true, previews: saved });
}

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Lightweight "anything new?" probe — Instagram/Twitter pattern.
 *
 * Full `/api/feed` re-ranks candidates, signs media URLs, loads affinity.
 * Polling that every 25s is the main reason the app feels like it is
 * "always updating". This endpoint only asks Postgres for the newest
 * post id + created_at visible under RLS (cheap index scan).
 *
 * Client only calls the heavy feed fetch when `latestId` differs from
 * what it already has at the top of the list.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("posts")
    .select("id, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      latestId: data?.id ?? null,
      latestAt: data?.created_at ?? null,
    },
    {
      headers: {
        // Personalized — never shared CDN cache. Browser may hold briefly.
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    },
  );
}

import { NextResponse } from "next/server";

import { FEED_PAGE_SIZE, loadFeedPage } from "@/lib/posts/feed";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Paginated feed JSON for infinite scroll (auth required). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);
  const limit = Math.min(
    30,
    Math.max(1, Number(searchParams.get("limit") ?? FEED_PAGE_SIZE) || FEED_PAGE_SIZE),
  );
  const authorId = searchParams.get("authorId") || undefined;

  const page = await loadFeedPage(supabase, user.id, {
    offset,
    limit,
    authorId,
  });

  return NextResponse.json(
    {
      posts: page.posts,
      nextOffset: page.nextOffset,
    },
    {
      headers: {
        // Personalized feed — never public CDN. Client owns freshness.
        "Cache-Control": "private, no-store",
      },
    },
  );
}

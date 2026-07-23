import { NextResponse } from "next/server";

import { searchPeopleSuggestions } from "@/lib/social/suggestions";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Full-network search for the "Pessoas" > "Sugestões" search box.
 *
 * See searchPeopleSuggestions() in lib/social/suggestions.ts for why
 * this exists: the search box previously only filtered whatever
 * suggestion pages were already loaded client-side, so accounts deep
 * in the pagination (or not loaded yet) silently "didn't exist" to
 * search even though they were fully reachable by scrolling further.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 80);

  if (!q) {
    return NextResponse.json(
      { results: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const results = await searchPeopleSuggestions(supabase, user.id, q, 40);

  return NextResponse.json(
    { results },
    {
      headers: {
        // Personalized (excludes viewer's own graph) — never public CDN.
        "Cache-Control": "private, no-store",
      },
    },
  );
}

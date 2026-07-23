import { NextResponse } from "next/server";

import {
  PEOPLE_SUGGESTIONS_PAGE_SIZE,
  loadPeopleSuggestions,
} from "@/lib/social/suggestions";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Paginated "Pessoas que talvez conheças" JSON for infinite scroll / "Ver mais". */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("university, campus, course")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);
  const limit = Math.min(
    50,
    Math.max(
      1,
      Number(searchParams.get("limit") ?? PEOPLE_SUGGESTIONS_PAGE_SIZE) ||
        PEOPLE_SUGGESTIONS_PAGE_SIZE,
    ),
  );

  const page = await loadPeopleSuggestions(supabase, user.id, profile, {
    offset,
    limit,
  });

  return NextResponse.json(
    {
      suggestions: page.suggestions,
      nextOffset: page.nextOffset,
    },
    {
      headers: {
        // Personalized, viewer-specific ranking — never public CDN.
        "Cache-Control": "private, no-store",
      },
    },
  );
}

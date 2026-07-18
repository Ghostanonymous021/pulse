import type { SupabaseClient } from "@supabase/supabase-js";

export type MentionCandidate = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

/**
 * @ autocomplete — only people the current user follows (status accepted).
 * Product logic: mention your circle, not the whole university network.
 */
export async function searchMentionCandidates(
  supabase: SupabaseClient,
  rawQuery: string,
  limit = 8,
): Promise<MentionCandidate[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const q = rawQuery.trim().replace(/^@/, "").toLowerCase();

  const { data: follows, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)
    .eq("status", "accepted")
    .limit(300);

  if (error) {
    console.error("searchMentionCandidates follows", error.message);
    return [];
  }

  const ids = [
    ...new Set(
      (follows ?? [])
        .map((f) => f.following_id as string)
        .filter((id) => id && id !== user.id),
    ),
  ];

  if (!ids.length) return [];

  // Chunk .in() for large following lists
  const people: MentionCandidate[] = [];
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", slice);

    if (pErr) {
      console.error("searchMentionCandidates profiles", pErr.message);
      continue;
    }
    for (const p of profiles ?? []) {
      people.push(p as MentionCandidate);
    }
  }

  return filterAndRank(people, q, limit);
}

function filterAndRank(
  people: MentionCandidate[],
  q: string,
  limit: number,
): MentionCandidate[] {
  if (!q) {
    return [...people]
      .sort((a, b) =>
        (a.display_name || a.username).localeCompare(
          b.display_name || b.username,
          "pt",
        ),
      )
      .slice(0, limit);
  }

  const prefix: MentionCandidate[] = [];
  const contains: MentionCandidate[] = [];

  for (const p of people) {
    const u = p.username.toLowerCase();
    const d = (p.display_name || "").toLowerCase();
    if (u.startsWith(q) || d.startsWith(q)) prefix.push(p);
    else if (u.includes(q) || d.includes(q)) contains.push(p);
  }

  const byUser = (a: MentionCandidate, b: MentionCandidate) =>
    a.username.localeCompare(b.username, "pt");

  return [...prefix.sort(byUser), ...contains.sort(byUser)].slice(0, limit);
}

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const uid = user.id;

  const [
    profile,
    posts,
    media,
    likes,
    comments,
    followers,
    following,
    reports,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("posts").select("*").eq("author_id", uid),
    supabase
      .from("post_media")
      .select("*, posts!inner(author_id)")
      .eq("posts.author_id", uid),
    supabase.from("likes").select("*").eq("user_id", uid),
    supabase.from("comments").select("*").eq("author_id", uid),
    supabase
      .from("follows")
      .select("follower_id, status, created_at")
      .eq("following_id", uid),
    supabase
      .from("follows")
      .select("following_id, status, created_at")
      .eq("follower_id", uid),
    supabase.from("reports").select("*").eq("reporter_id", uid),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    user_id: uid,
    profile: profile.data,
    posts: posts.data ?? [],
    post_media: media.data ?? [],
    likes: likes.data ?? [],
    comments: comments.data ?? [],
    followers: followers.data ?? [],
    following: following.data ?? [],
    reports: reports.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pulse-dados.json"`,
      "Cache-Control": "no-store",
    },
  });
}

import { notFound } from "next/navigation";

import { CommentThread } from "@/components/feed/comment-thread";
import { PostCard } from "@/components/feed/post-card";
import { PageHeader } from "@/components/nav/page-header";
import { requireUser } from "@/lib/auth/session";
import { buildCommentTree } from "@/lib/comments/tree";
import { loadPostById } from "@/lib/posts/feed";

type Props = { params: Promise<{ id: string }> };

export default async function PostDetailPage({ params }: Props) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const post = await loadPostById(supabase, user.id, id);
  if (!post) notFound();

  const { data: commentsRaw } = await supabase
    .from("comments")
    .select(
      `
      id,
      post_id,
      author_id,
      body,
      parent_id,
      reply_to_username,
      created_at,
      author:profiles!comments_author_id_fkey (
        username,
        display_name,
        avatar_url
      ),
      comment_likes ( user_id )
    `,
    )
    .eq("post_id", id)
    .order("created_at", { ascending: true });

  type Raw = {
    id: string;
    post_id: string;
    author_id: string;
    body: string;
    parent_id: string | null;
    reply_to_username: string | null;
    created_at: string;
    author:
      | { username: string; display_name: string; avatar_url: string | null }
      | { username: string; display_name: string; avatar_url: string | null }[]
      | null;
    comment_likes?: { user_id: string }[];
  };

  const flat = ((commentsRaw ?? []) as unknown as Raw[]).map((c) => {
    const author = Array.isArray(c.author) ? c.author[0] : c.author;
    const likes = c.comment_likes ?? [];
    return {
      id: c.id,
      post_id: c.post_id,
      author_id: c.author_id,
      body: c.body,
      parent_id: c.parent_id,
      reply_to_username: c.reply_to_username ?? null,
      created_at: c.created_at,
      author: author
        ? {
            username: author.username,
            display_name: author.display_name,
            avatar_url: author.avatar_url,
          }
        : null,
      like_count: likes.length,
      liked_by_me: likes.some((l) => l.user_id === user.id),
    };
  });

  const tree = buildCommentTree(flat);

  return (
    <div className="min-h-dvh">
      <PageHeader title="Publicacao" backHref="/home" />
      <PostCard post={post} variant="detail" />
      <section className="border-t border-[var(--separator)] px-4 pt-5">
        <h2
          data-app-chrome
          className="mb-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          Comentários
        </h2>
        <CommentThread postId={id} tree={tree} />
      </section>
    </div>
  );
}

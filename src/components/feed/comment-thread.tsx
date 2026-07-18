"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";

import { MentionField } from "@/components/compose/mention-field";
import { UserAvatar } from "@/components/profile/user-avatar";
import { FixedBottomBar } from "@/components/ui/fixed-bottom-bar";
import {
  INITIAL_REPLY_VISIBLE,
  type CommentNode,
} from "@/lib/comments/tree";
import { contentSegments } from "@/lib/mentions/segments";
import { createClient } from "@/lib/supabase/client";
import { useKeyboardInset } from "@/lib/ui/use-keyboard-inset";
import { cn } from "@/lib/utils";

/**
 * Comments: max 2 visual levels (root + replies).
 * Composer tracks virtual keyboard (no fixed-bottom dance).
 */
export function CommentThread({
  postId,
  tree,
}: {
  postId: string;
  tree: CommentNode[];
}) {
  const [replyTo, setReplyTo] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const keyboard = useKeyboardInset();
  // Reserve space so last comments stay above the bar (+ keyboard)
  const bottomPad = Math.max(keyboard + 88, 112);

  return (
    <div className="relative flex min-h-[40vh] flex-col">
      <div
        className="min-h-0 flex-1 space-y-5"
        style={{ paddingBottom: bottomPad }}
      >
        {tree.length === 0 && (
          <p className="py-6 text-center text-[14px] text-muted-foreground">
            Ainda sem comentarios.
          </p>
        )}
        {tree.map((node) => (
          <CommentBlock
            key={node.id}
            node={node}
            postId={postId}
            depth={0}
            onReply={(id, label) => setReplyTo({ id, label })}
          />
        ))}
      </div>

      <FixedBottomBar innerClassName="px-3 pt-2">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-1.5 text-[12px]">
            <span className="truncate text-muted-foreground">
              A responder a <strong>{replyTo.label}</strong>
            </span>
            <button
              type="button"
              className="ml-2 font-medium"
              onClick={() => setReplyTo(null)}
            >
              Cancelar
            </button>
          </div>
        )}
        <CommentComposer
          postId={postId}
          parentId={replyTo?.id}
          onDone={() => setReplyTo(null)}
          placeholder={
            replyTo
              ? `Resposta a ${replyTo.label}`
              : "Escreve um comentario..."
          }
        />
      </FixedBottomBar>
    </div>
  );
}

function CommentBlock({
  node,
  postId,
  depth,
  onReply,
}: {
  node: CommentNode;
  postId: string;
  depth: 0 | 1;
  onReply: (id: string, label: string) => void;
}) {
  const name = node.author?.display_name || node.author?.username || "user";
  const handle = node.author?.username;
  const [showAll, setShowAll] = useState(false);

  const replies = node.replies;
  const hidden = Math.max(0, replies.length - INITIAL_REPLY_VISIBLE);
  const visibleReplies =
    depth === 0
      ? showAll
        ? replies
        : replies.slice(0, INITIAL_REPLY_VISIBLE)
      : [];

  return (
    <div
      className={cn(
        // Only one indent level for replies — never nest further
        depth > 0 && "ml-3 border-l border-[var(--separator)] pl-3",
      )}
    >
      <div className="flex gap-2.5">
        <div className="mt-0.5 shrink-0">
          <UserAvatar
            userId={node.author_id}
            avatarUrl={node.author?.avatar_url}
            name={name}
            size={32}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="rounded-[var(--radius-md)] bg-muted/60 px-3 py-2">
            {handle ? (
              <Link
                href={`/u/${handle}`}
                className="text-[13px] font-semibold tracking-[-0.01em] hover:opacity-70"
              >
                {name}
              </Link>
            ) : (
              <span className="text-[13px] font-semibold">{name}</span>
            )}
            {node.reply_to_username && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Respondendo a{" "}
                <Link
                  href={`/u/${node.reply_to_username}`}
                  className="font-medium text-foreground/80 hover:opacity-70"
                >
                  @{node.reply_to_username}
                </Link>
              </p>
            )}
            <p
              data-user-content
              className="mt-0.5 whitespace-pre-wrap text-[14px] leading-[1.45] tracking-[-0.01em]"
            >
              <CommentBody text={node.body} />
            </p>
          </div>

          <div className="mt-1 flex items-center gap-3 px-1">
            <CommentLike
              commentId={node.id}
              initialLiked={node.liked_by_me}
              initialCount={node.like_count}
            />
            <button
              type="button"
              onClick={() => onReply(node.id, handle ? `@${handle}` : name)}
              className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Responder
            </button>
            <time className="text-[11px] text-muted-foreground">
              {formatRelative(node.created_at)}
            </time>
          </div>

          {depth === 0 && visibleReplies.length > 0 && (
            <div className="mt-3 space-y-3">
              {visibleReplies.map((r) => (
                <CommentBlock
                  key={r.id}
                  node={r}
                  postId={postId}
                  depth={1}
                  onReply={onReply}
                />
              ))}
              {!showAll && hidden > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="pl-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Ver mais {hidden}{" "}
                  {hidden === 1 ? "resposta" : "respostas"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CommentBody({ text }: { text: string }) {
  const segments = contentSegments(text);
  return (
    <>
      {segments.map((s, i) => {
        if (s.type === "url") {
          return (
            <a
              key={i}
              href={s.value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#007AFF] underline-offset-2 hover:underline dark:text-[#0A84FF]"
            >
              {s.value}
            </a>
          );
        }
        if (s.type === "mention") {
          return (
            <Link
              key={i}
              href={`/u/${encodeURIComponent(s.username)}`}
              className="font-medium text-[#007AFF] hover:underline dark:text-[#0A84FF]"
            >
              {s.value}
            </Link>
          );
        }
        return <span key={i}>{s.value}</span>;
      })}
    </>
  );
}

function CommentLike({
  commentId,
  initialLiked,
  initialCount,
}: {
  commentId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const next = !liked;
      const prevLiked = liked;
      const prevCount = count;
      setLiked(next);
      setCount((c) => c + (next ? 1 : -1));

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLiked(prevLiked);
        setCount(prevCount);
        return;
      }

      if (next) {
        const { error } = await supabase.from("comment_likes").insert({
          user_id: user.id,
          comment_id: commentId,
        });
        if (error) {
          setLiked(prevLiked);
          setCount(prevCount);
          return;
        }
      } else {
        const { error } = await supabase
          .from("comment_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("comment_id", commentId);
        if (error) {
          setLiked(prevLiked);
          setCount(prevCount);
          return;
        }
      }
      // No router.refresh — optimistic only (native feel)
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
    >
      <Heart
        className={cn(
          "h-3.5 w-3.5",
          liked && "fill-[#ff3b30] text-[#ff3b30]",
        )}
        strokeWidth={1.75}
      />
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}

function CommentComposer({
  postId,
  parentId,
  placeholder = "Escreve um comentario...",
  onDone,
}: {
  postId: string;
  parentId?: string;
  placeholder?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: user.id,
        body: text,
        parent_id: parentId ?? null,
      });
      if (error) throw error;
      setBody("");
      onDone?.();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-end gap-2"
      // Prevent iOS zoom thrash + keep bar stable while typing
      onFocusCapture={() => {
        // After keyboard settles, keep the focused field in view without jumping the whole page
        window.setTimeout(() => {
          const el = document.activeElement;
          if (el instanceof HTMLElement) {
            el.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }, 80);
      }}
    >
      <div className="min-w-0 flex-1">
        <MentionField
          as="input"
          value={body}
          onChange={setBody}
          placeholder={placeholder}
          maxLength={2000}
          listPlacement="above"
          enterKeyHint="send"
          autoComplete="off"
          className="h-11 w-full rounded-full border border-[var(--separator)] bg-card px-4 text-[16px] outline-none ring-foreground/10 placeholder:text-muted-foreground focus:ring-2"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !body.trim()}
        className="mb-0.5 h-11 shrink-0 px-2 text-[15px] font-semibold tracking-[-0.01em] disabled:opacity-35"
      >
        Publicar
      </button>
    </form>
  );
}

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

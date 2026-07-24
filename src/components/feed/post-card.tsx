"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { LinkPreviewCard } from "@/components/feed/link-preview-card";
import { LinkifiedText } from "@/components/feed/linkified-text";
import { MediaFrame } from "@/components/feed/media-frame";
import { MediaLightbox } from "@/components/feed/media-lightbox";
import { PostActions } from "@/components/feed/post-actions";
import {
  PostFollowIcon,
  type PostFollowState,
} from "@/components/feed/post-follow-icon";
import { PostMenu } from "@/components/feed/post-menu";
import { UserAvatar } from "@/components/profile/user-avatar";
import { VerifiedBadge } from "@/components/social/verified-badge";
import type { LinkPreview } from "@/lib/links/preview";
import { isAuthorMuted } from "@/lib/social/mute";
import {
  isVerificationActive,
  verificationBadgeType,
} from "@/lib/settings/verification";
import type { Post, Profile } from "@/types/database";
import { cn } from "@/lib/utils";

export type PostMediaView = {
  id: string;
  storage_path: string;
  url: string | null;
  position: number;
};

export type PostWithAuthor = Post & {
  author: Pick<
    Profile,
    | "id"
    | "username"
    | "display_name"
    | "avatar_url"
    | "account_type"
    | "is_private"
    | "is_verified"
    | "verified_type"
    | "verification_expires_at"
  > | null;
  media?: PostMediaView[];
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
  /** Viewer follow state toward author — feed injects this. */
  follow_state?: PostFollowState;
  /** Cached at publish time — never live-scraped. */
  link_previews?: LinkPreview[];
};

/**
 * Clean publication block — no floating card chrome.
 * Header: display name only (no @username), optional follow icon, overflow menu.
 * See docs/UX_PUBLICACOES.md.
 */
export function PostCard({
  post,
  variant = "feed",
}: {
  post: PostWithAuthor;
  variant?: "feed" | "detail";
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [hidden, setHidden] = useState(false);

  const name =
    post.author?.display_name || post.author?.username || "Utilizador";
  const handle = post.author?.username;
  const when = formatRelative(post.created_at);
  const media = (post.media ?? []).filter((m) => m.url);
  const expanded = variant === "detail";
  const isFeed = variant === "feed";
  const followState = post.follow_state ?? "none";

  useEffect(() => {
    if (post.author_id) setHidden(isAuthorMuted(post.author_id));
  }, [post.author_id]);

  if (hidden) return null;

  return (
    <article
      className={cn(
        "bg-background",
        isFeed && "border-b border-[var(--separator)]",
      )}
    >
      {/* Header — single-line name, no @username */}
      <div
        data-app-chrome
        className="flex items-center gap-3 px-4 py-3"
      >
        <Link
          href={handle ? `/u/${handle}` : "#"}
          className="shrink-0 rounded-full"
        >
          <UserAvatar
            userId={post.author_id}
            avatarUrl={post.author?.avatar_url}
            name={name}
            size={36}
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <Link
              href={handle ? `/u/${handle}` : "#"}
              className="min-w-0 truncate text-[14.5px] font-semibold leading-tight tracking-[-0.02em] hover:opacity-70"
              title={name}
            >
              {name}
            </Link>
            {post.author && isVerificationActive(post.author) && (
              <VerifiedBadge
                accountType={verificationBadgeType(post.author)}
                size="sm"
              />
            )}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            {post.is_highlighted && (
              <span className="shrink-0 rounded-full bg-brand-accent-soft px-1.5 py-[1px] text-[10.5px] font-semibold tracking-[-0.01em] text-brand-accent">
                Destaque
              </span>
            )}
            <time
              dateTime={post.created_at}
              className="shrink-0 text-[12.5px] leading-tight text-muted-foreground"
            >
              {when}
            </time>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <PostFollowIcon
            authorId={post.author_id}
            initialState={followState}
          />
          <PostMenu
            postId={post.id}
            authorId={post.author_id}
            authorUsername={handle}
            onMuted={() => setHidden(true)}
          />
        </div>
      </div>

      {/* Media — fixed 4:5 + object-contain (full photo, no crop) */}
      {media.length > 0 && (
        <MediaFrame
          media={media}
          postId={post.id}
          mode={isFeed ? "feed" : "detail"}
          onOpenLightbox={(i) => {
            setLightboxIndex(i);
            setLightboxOpen(true);
          }}
        />
      )}

      {/* Body + actions */}
      <div className="px-4 pb-4 pt-3">
        {post.body && (
          <LinkifiedText text={post.body} expanded={expanded} />
        )}

        {(post.link_previews ?? []).slice(0, 1).map((preview) => (
          <LinkPreviewCard key={preview.id} preview={preview} />
        ))}

        <PostActions
          postId={post.id}
          initialLiked={Boolean(post.liked_by_me)}
          initialLikeCount={post.like_count ?? 0}
          commentCount={post.comment_count ?? 0}
        />
      </div>

      {variant === "detail" && media.length > 0 && (
        <MediaLightbox
          media={media}
          startIndex={lightboxIndex}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </article>
  );
}

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
  });
}

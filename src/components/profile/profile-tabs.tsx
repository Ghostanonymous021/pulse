import Link from "next/link";

import { Clock, FileText } from "lucide-react";

import { FeedScopeTabs } from "@/components/feed/feed-scope-tabs";
import type { PostWithAuthor } from "@/components/feed/post-card";
import type { FeedScope } from "@/lib/posts/feed";

/**
 * Profile content — posts only (workspaces/espacos removed from the
 * profile view per product decision; the /w routes themselves stay
 * intact, just no longer surfaced here).
 */
export function ProfileTabs({
  posts,
  scope = "all",
  basePath,
}: {
  posts: PostWithAuthor[];
  scope?: FeedScope;
  basePath?: string;
}) {
  return (
    <div className="mt-4 border-t border-[var(--separator)]">
      {basePath && <FeedScopeTabs basePath={basePath} scope={scope} />}
      <div className="min-h-[12rem]">
        {posts.length === 0 ? (
          <p className="px-4 py-16 text-center text-[14px] text-muted-foreground">
            {scope === "temporarias"
              ? "Sem publicacoes temporarias por agora."
              : "Ainda sem publicacoes. O que quiseres partilhar comeca aqui."}
          </p>
        ) : (
          <PostsGrid posts={posts} />
        )}
      </div>
    </div>
  );
}

function PostsGrid({ posts }: { posts: PostWithAuthor[] }) {
  return (
    <div className="grid grid-cols-3 gap-px bg-background">
      {posts.map((post) => {
        const cover = post.media?.find((m) => m.url)?.url ?? null;
        const multi = (post.media?.length ?? 0) > 1;
        const text = (post.body ?? "").trim();

        return (
          <Link
            key={post.id}
            href={`/p/${post.id}`}
            className="relative aspect-square bg-muted transition-opacity hover:opacity-90"
          >
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full items-start bg-[var(--card)] p-2.5">
                {text ? (
                  <p className="line-clamp-6 text-[11px] leading-[1.35] tracking-[-0.01em] text-foreground/90">
                    {text}
                  </p>
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <FileText className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                )}
              </div>
            )}
            {post.expires_at && (
              <span
                className="absolute left-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white"
                aria-hidden
              >
                <Clock className="h-2.5 w-2.5" strokeWidth={2} />
              </span>
            )}
            {multi && (
              <span
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white shadow-sm ring-1 ring-black/20"
                aria-hidden
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}

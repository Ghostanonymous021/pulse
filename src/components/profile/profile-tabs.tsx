"use client";

import { useState } from "react";
import Link from "next/link";

import { FileText } from "lucide-react";

import type { PostWithAuthor } from "@/components/feed/post-card";
import type { WorkspaceWithMeta } from "@/lib/workspaces/types";
import { WorkspaceCard } from "@/components/workspaces/workspace-card";

export function ProfileTabs({
  posts,
  workspaceCount = 0,
  workspaces = [],
  isOwn = false,
}: {
  posts: PostWithAuthor[];
  workspaceCount?: number;
  workspaces?: WorkspaceWithMeta[];
  isOwn?: boolean;
}) {
  const [tab, setTab] = useState("posts");

  return (
    <div className="mt-4 border-t border-[var(--separator)]">
      <div className="flex border-b border-[var(--separator)]">
        <button
          type="button"
          onClick={() => setTab("posts")}
          className={`
            relative flex-1 py-3 text-[14px] font-medium transition-colors
            ${tab === "posts" ? "text-foreground" : "text-muted-foreground"}
          `}
        >
          Publicacoes
          {tab === "posts" && (
            <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-foreground" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("workspaces")}
          className={`
            relative flex-1 py-3 text-[14px] font-medium transition-colors
            ${tab === "workspaces" ? "text-foreground" : "text-muted-foreground"}
          `}
        >
          Espacos {workspaceCount > 0 && `(${workspaceCount})`}
          {tab === "workspaces" && (
            <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-foreground" />
          )}
        </button>
      </div>

      <div className="min-h-[12rem]">
        {tab === "posts" && (
          posts.length === 0 ? (
            <p className="px-4 py-16 text-center text-[14px] text-muted-foreground">
              Ainda sem publicacoes.
            </p>
          ) : (
            <PostsGrid posts={posts} />
          )
        )}

        {tab === "workspaces" && (
          workspaces.length === 0 && !isOwn ? (
            <p className="px-4 py-16 text-center text-[14px] text-muted-foreground">
              Sem espacos publicos ainda.
            </p>
          ) : workspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[14px] text-muted-foreground">
                Ainda sem espacos.
              </p>
              {isOwn && (
                <Link
                  href="/w/new"
                  className="mt-2 text-[14px] font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Criar primeiro espaco
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-3 p-4">
              {workspaces.map((ws) => (
                <WorkspaceCard key={ws.id} workspace={ws} />
              ))}
            </div>
          )
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

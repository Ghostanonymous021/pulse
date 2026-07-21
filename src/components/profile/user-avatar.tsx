"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import {
  AVATAR_CHANGED_EVENT,
  type AvatarChangedDetail,
  readCachedAvatar,
  withAvatarCacheBust,
} from "@/lib/profile/avatar";
import { cn } from "@/lib/utils";

export function UserAvatar({
  userId,
  avatarUrl,
  name,
  size = 36,
  className,
  updatedAt,
}: {
  userId: string;
  avatarUrl: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
  updatedAt?: string | null;
}) {
  const [src, setSrc] = useState<string | null>(() => {
    const cached = readCachedAvatar(userId);
    if (cached) return withAvatarCacheBust(cached.url, cached.version);
    return withAvatarCacheBust(avatarUrl, updatedAt ?? null);
  });

  useEffect(() => {
    const cached = readCachedAvatar(userId);
    if (cached) {
      setSrc(withAvatarCacheBust(cached.url, cached.version));
      return;
    }
    setSrc(withAvatarCacheBust(avatarUrl, updatedAt ?? null));
  }, [userId, avatarUrl, updatedAt]);

  useEffect(() => {
    function onChange(e: Event) {
      const detail = (e as CustomEvent<AvatarChangedDetail>).detail;
      if (!detail || detail.userId !== userId) return;
      setSrc(withAvatarCacheBust(detail.avatarUrl, detail.version));
    }
    window.addEventListener(AVATAR_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(AVATAR_CHANGED_EVENT, onChange);
  }, [userId]);

  const initial = (name || "?").slice(0, 1).toUpperCase();

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[12px] font-semibold text-muted-foreground",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34) }}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          className="object-cover"
          draggable={false}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          {initial}
        </span>
      )}
    </span>
  );
}

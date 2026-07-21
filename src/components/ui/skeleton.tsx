import { cn } from "@/lib/utils";

/** Base pulsing block — building unit for all skeleton screens. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("skeleton-shimmer rounded-md", className)} />
  );
}

/** Skeleton for a single feed post card. */
export function PostSkeleton() {
  return (
    <div className="border-b border-[var(--separator)] px-4 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="h-2.5 w-16 rounded-full" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-4/5 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-48 w-full rounded-xl" />
    </div>
  );
}

/** Skeleton feed — N stacked post skeletons. */
export function FeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton for a profile header while data loads. */
export function ProfileHeaderSkeleton() {
  return (
    <div className="px-4 py-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32 rounded-full" />
          <Skeleton className="h-2.5 w-20 rounded-full" />
          <div className="flex gap-4 pt-1">
            <Skeleton className="h-2.5 w-12 rounded-full" />
            <Skeleton className="h-2.5 w-12 rounded-full" />
            <Skeleton className="h-2.5 w-12 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton grid for profile posts tab. */
export function ProfileGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-none" />
      ))}
    </div>
  );
}

/** Skeleton row for a conversation/notification/person list item. */
export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-2/5 rounded-full" />
        <Skeleton className="h-2.5 w-3/5 rounded-full" />
      </div>
    </div>
  );
}

/** Skeleton list — N stacked row skeletons (conversations, notifications). */
export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </div>
  );
}

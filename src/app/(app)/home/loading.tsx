import { FeedSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="pb-2">
      <div className="sticky top-0 z-20 flex h-12 items-center border-b border-[var(--separator)] bg-[var(--elevated)] px-4 backdrop-blur-xl backdrop-saturate-150">
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <FeedSkeleton />
    </div>
  );
}

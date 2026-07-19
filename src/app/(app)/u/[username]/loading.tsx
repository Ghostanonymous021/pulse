import { ProfileGridSkeleton, ProfileHeaderSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <ProfileHeaderSkeleton />
      <ProfileGridSkeleton />
    </div>
  );
}

import Link from "next/link";

import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { ProfileLinksRow } from "@/components/profile/profile-links-row";
import { VerifiedBadge } from "@/components/social/verified-badge";
import type { ProfileLink } from "@/lib/links/profile-links";
import {
  isVerificationActive,
  verificationBadgeType,
} from "@/lib/settings/verification";
import type { Profile } from "@/types/database";

export function ProfileHeader({
  profile,
  counts,
  isOwn,
  links = [],
}: {
  profile: Profile;
  counts: { posts: number; followers: number; following: number };
  isOwn: boolean;
  links?: ProfileLink[];
}) {
  const metaLine = [profile.university, profile.campus, profile.course]
    .filter(Boolean)
    .join(" · ");

  const base = isOwn ? "/perfil" : `/u/${profile.username}`;
  const verified = isVerificationActive(profile);
  const badgeType = verificationBadgeType(profile);

  return (
    <div className="pb-1">
      <div data-app-chrome className="flex items-start px-4 pt-5">
        <ProfileAvatar
          userId={profile.id}
          avatarUrl={profile.avatar_url}
          name={profile.display_name || profile.username}
          isOwn={isOwn}
          size={76}
        />
        <div className="min-w-0 flex-1 space-y-0.5 pt-1.5">
          <h1 className="flex min-w-0 items-center gap-1.5 text-[20px] font-semibold tracking-[-0.03em]">
            <span className="truncate">
              {profile.display_name || profile.username}
            </span>
            {verified && <VerifiedBadge accountType={badgeType} size="md" />}
          </h1>
          <p className="text-[14px] text-muted-foreground">
            @{profile.username}
            {profile.account_type === "organizacao" ? " · Organização" : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 px-4">
        {profile.bio && (
          <p
            data-user-content
            className="text-[15px] leading-[1.45] tracking-[-0.01em]"
          >
            {profile.bio}
          </p>
        )}
        {metaLine && (
          <p
            data-app-chrome
            className="mt-1.5 text-[13px] text-muted-foreground"
          >
            {metaLine}
          </p>
        )}

        <ProfileLinksRow links={links} />

        {/* Counts — followers/following open lists (IG pattern) */}
        <div data-app-chrome className="mt-4 flex gap-5 text-[14px]">
          <span>
            <strong className="font-semibold tabular-nums tracking-tight">
              {counts.posts}
            </strong>{" "}
            <span className="text-muted-foreground">publicações</span>
          </span>
          <Link
            href={`${base}/seguidores`}
            className="transition-opacity hover:opacity-70"
          >
            <strong className="font-semibold tabular-nums tracking-tight">
              {counts.followers}
            </strong>{" "}
            <span className="text-muted-foreground">seguidores</span>
          </Link>
          <Link
            href={`${base}/a-seguir`}
            className="transition-opacity hover:opacity-70"
          >
            <strong className="font-semibold tabular-nums tracking-tight">
              {counts.following}
            </strong>{" "}
            <span className="text-muted-foreground">a seguir</span>
          </Link>
        </div>

        {/* Editar perfil vive so em Definicoes — evita duplicar CTAs no perfil */}
      </div>
    </div>
  );
}

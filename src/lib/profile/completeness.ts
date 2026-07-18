import type { Profile } from "@/types/database";

export type ProfileGap = {
  key: string;
  label: string;
};

/** Fields that make the profile "ready" for campus social context. */
export function getProfileGaps(profile: Profile): ProfileGap[] {
  const gaps: ProfileGap[] = [];
  if (!profile.avatar_url) gaps.push({ key: "avatar", label: "foto" });
  if (!profile.display_name?.trim()) gaps.push({ key: "name", label: "nome" });
  if (!profile.bio?.trim()) gaps.push({ key: "bio", label: "bio" });
  if (!profile.university?.trim())
    gaps.push({ key: "university", label: "universidade" });
  if (!profile.campus?.trim()) gaps.push({ key: "campus", label: "campus" });
  if (!profile.course?.trim()) gaps.push({ key: "course", label: "curso" });
  return gaps;
}

export function profileCompletion(profile: Profile) {
  const total = 6;
  const gaps = getProfileGaps(profile);
  const done = total - gaps.length;
  return {
    done,
    total,
    percent: Math.round((done / total) * 100),
    gaps,
    complete: gaps.length === 0,
  };
}

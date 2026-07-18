import type { SupabaseClient } from "@supabase/supabase-js";

import {
  avatarStoragePath,
  emitAvatarChanged,
  withAvatarCacheBust,
} from "@/lib/profile/avatar";

const MAX = 5 * 1024 * 1024;

/**
 * Upload profile photo to a single stable storage key and update profiles.avatar_url.
 * Emits client event so feed/chat/lists refresh without full reload.
 */
export async function uploadProfileAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<{ url: string; version: string }> {
  const type = file.type || "";
  const okType =
    type.startsWith("image/") ||
    /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!okType) throw new Error("Escolhe uma imagem da galeria.");
  if (file.size > MAX) throw new Error("Maximo 5 MB.");

  // Always same object key so every surface points at the same file
  const path = avatarStoragePath(userId);
  let contentType = type || "image/jpeg";
  if (type === "image/png" || /\.png$/i.test(file.name)) {
    contentType = "image/png";
  } else if (type === "image/webp" || /\.webp$/i.test(file.name)) {
    contentType = "image/webp";
  } else if (/heic|heif/i.test(type) || /\.heic$/i.test(file.name)) {
    contentType = type || "image/heic";
  } else {
    contentType = type || "image/jpeg";
  }

  const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
    contentType,
    upsert: true,
    cacheControl: "60",
  });
  if (upErr) throw upErr;

  const version = String(Date.now());
  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  // Persist busted URL so SSR/HTML also invalidates CDN/browser cache
  const url = withAvatarCacheBust(pub.publicUrl, version)!;

  const { error: pErr } = await supabase
    .from("profiles")
    .update({
      avatar_url: url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (pErr) throw pErr;

  emitAvatarChanged({ userId, avatarUrl: url, version });
  return { url, version };
}

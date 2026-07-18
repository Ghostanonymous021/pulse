import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "post-media";
const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DEFAULT_EXPIRES = 3600;

/** Request-scoped memo so one feed load signs each path once. */
const pathCache = new Map<string, { url: string; exp: number }>();

export function validateImageFile(file: File): string | null {
  if (!ALLOWED.has(file.type)) {
    return "Usa JPEG, PNG, WebP ou GIF.";
  }
  if (file.size > MAX_BYTES) {
    return "Cada imagem deve ter no máximo 10 MB.";
  }
  return null;
}

export function maxPostImages() {
  return MAX_FILES;
}

export async function signedMediaUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresSec = DEFAULT_EXPIRES,
) {
  const map = await signedMediaUrls(supabase, [storagePath], expiresSec);
  return map.get(storagePath) ?? null;
}

/**
 * Batch-sign storage paths (one Storage API call per chunk).
 * Critical for feed TTFB — avoids N sequential createSignedUrl round-trips.
 */
export async function signedMediaUrls(
  supabase: SupabaseClient,
  storagePaths: string[],
  expiresSec = DEFAULT_EXPIRES,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const now = Date.now();
  const unique = [...new Set(storagePaths.filter(Boolean))];
  const missing: string[] = [];

  for (const p of unique) {
    const hit = pathCache.get(p);
    if (hit && hit.exp > now + 60_000) {
      out.set(p, hit.url);
    } else {
      missing.push(p);
    }
  }

  if (!missing.length) return out;

  // Supabase signs in batches; chunk to stay under payload limits
  const CHUNK = 50;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const slice = missing.slice(i, i + CHUNK);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(slice, expiresSec);

    if (error) {
      console.error("createSignedUrls", error.message);
      // Fallback: one-by-one for this chunk
      await Promise.all(
        slice.map(async (path) => {
          const { data: one } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(path, expiresSec);
          if (one?.signedUrl) {
            out.set(path, one.signedUrl);
            pathCache.set(path, {
              url: one.signedUrl,
              exp: now + expiresSec * 1000,
            });
          }
        }),
      );
      continue;
    }

    for (const row of data ?? []) {
      if (row.path && row.signedUrl && !row.error) {
        out.set(row.path, row.signedUrl);
        pathCache.set(row.path, {
          url: row.signedUrl,
          exp: now + expiresSec * 1000,
        });
      }
    }
  }

  return out;
}

/** Chat media bucket batch sign. */
export async function signedChatUrls(
  supabase: SupabaseClient,
  storagePaths: string[],
  expiresSec = DEFAULT_EXPIRES,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(storagePaths.filter(Boolean))];
  if (!unique.length) return out;

  const CHUNK = 50;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const { data, error } = await supabase.storage
      .from("chat-media")
      .createSignedUrls(slice, expiresSec);

    if (error) {
      await Promise.all(
        slice.map(async (path) => {
          const { data: one } = await supabase.storage
            .from("chat-media")
            .createSignedUrl(path, expiresSec);
          if (one?.signedUrl) out.set(path, one.signedUrl);
        }),
      );
      continue;
    }

    for (const row of data ?? []) {
      if (row.path && row.signedUrl && !row.error) {
        out.set(row.path, row.signedUrl);
      }
    }
  }
  return out;
}

export async function uploadPostImages(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  files: File[],
) {
  const paths: { storage_path: string; mime_type: string; position: number }[] =
    [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const err = validateImageFile(file);
    if (err) throw new Error(err);

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";

    const storage_path = `${userId}/${postId}/${i}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storage_path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) throw error;

    paths.push({
      storage_path,
      mime_type: file.type,
      position: i,
    });
  }

  if (paths.length) {
    const { error } = await supabase.from("post_media").insert(
      paths.map((p) => ({
        post_id: postId,
        storage_path: p.storage_path,
        mime_type: p.mime_type,
        position: p.position,
      })),
    );
    if (error) throw error;
  }

  return paths;
}

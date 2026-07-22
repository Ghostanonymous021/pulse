import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security/client-ip";
import { assertSameOrigin } from "@/lib/security/origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "post-media";
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;
const MAX_PATHS_PER_REQUEST = 10;

/**
 * Server-side safety net for post images (2026-07-22 incident follow-up).
 *
 * Client-side compression (compress-image.ts) is the primary path and
 * handles the vast majority of uploads. But it depends on
 * `createImageBitmap`/`<img>.decode()` succeeding in the browser, and in
 * production a real (not hypothetical) slice of phone-camera JPEGs kept
 * arriving at full 3000-4000px / multi-MB resolution days after the client
 * fix shipped -- confirmed via EXIF still present (Apple/Samsung camera
 * tags), meaning the browser never actually re-encoded them.
 *
 * This route re-compresses anything the client left oversized, using
 * `sharp` (already present as a Next.js optional dependency for the image
 * optimizer). It is called fire-and-forget right after upload, same
 * pattern as /api/posts/link-previews -- never blocks or fails the publish
 * flow. If this route fails for any reason, the original image stays
 * served as-is; nothing regresses.
 */
export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const ip = clientIp(request);
  const limited = rateLimit(`process-media:${ip}`, {
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: { post_id?: string; storage_paths?: string[] };
  try {
    body = (await request.json()) as {
      post_id?: string;
      storage_paths?: string[];
    };
  } catch {
    return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
  }

  const postId = body.post_id;
  const storagePaths = (body.storage_paths ?? []).slice(
    0,
    MAX_PATHS_PER_REQUEST,
  );
  if (!postId || !storagePaths.length) {
    return NextResponse.json({ error: "Dados em falta." }, { status: 400 });
  }

  // Ownership check -- only the post author can trigger reprocessing of
  // their own media, and only for paths that actually belong to this post.
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, author_id")
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !post || post.author_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { data: mediaRows, error: mediaErr } = await supabase
    .from("post_media")
    .select("id, storage_path, mime_type")
    .eq("post_id", postId)
    .in("storage_path", storagePaths);
  if (mediaErr || !mediaRows?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const admin = createAdminClient();
  let processed = 0;

  for (const row of mediaRows) {
    try {
      const result = await reencodeOne(admin, row.storage_path, row.mime_type);
      if (result) {
        await supabase
          .from("post_media")
          .update({ width: result.width, height: result.height })
          .eq("id", row.id);
        processed++;
      }
    } catch (e) {
      console.error("process-media reencode failed", row.storage_path, e);
      // Keep going -- one bad image should not block the rest.
    }
  }

  return NextResponse.json({ ok: true, processed });
}

async function reencodeOne(
  admin: ReturnType<typeof createAdminClient>,
  storagePath: string,
  mimeType: string,
): Promise<{ width: number; height: number } | null> {
  if (mimeType === "image/gif") return null;

  const { data: blob, error: downloadErr } = await admin.storage
    .from(BUCKET)
    .download(storagePath);
  if (downloadErr || !blob) return null;

  const buf = Buffer.from(await blob.arrayBuffer());
  // Already small -- don't bother re-encoding (and don't report as a change).
  if (buf.byteLength <= 400 * 1024) return null;

  const { default: sharp } = await import("sharp");
  const image = sharp(buf, { failOn: "none" }).rotate(); // rotate() applies EXIF orientation, then strips it
  const meta = await image.metadata();
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);

  let pipeline = image;
  if (longest > MAX_DIMENSION) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const isPng = mimeType === "image/png";
  const output = isPng
    ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
    : await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer({ resolveWithObject: true });

  // Only replace if we actually made it smaller.
  if (output.data.byteLength >= buf.byteLength) return null;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, output.data, {
      contentType: mimeType,
      upsert: true,
    });
  if (uploadErr) return null;

  return { width: output.info.width, height: output.info.height };
}

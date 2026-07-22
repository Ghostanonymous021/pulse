/**
 * Client-side image resize/compress before upload — the actual fix
 * for slow-loading feed photos: phone cameras produce 3000-4000px,
 * multi-MB files, and none of that extra resolution is visible in a
 * ~365px feed card. Resizing here means every future upload is
 * already reasonably sized, for every consumer (feed, profile grid,
 * post detail) — no display-side change needed.
 *
 * GIFs are passed through untouched (canvas re-encoding would kill
 * animation). Anything already small enough is left alone too, to
 * avoid a pointless re-encode generation-loss round trip.
 *
 * Reliability note (found in production, 2026-07-22): `createImageBitmap`
 * silently fails to decode a meaningful share of real phone-camera JPEGs
 * on some Android/Safari builds (large-EXIF and specific chroma-subsample
 * variants), and the previous version had a single try/catch that quietly
 * returned the *original, uncompressed* file on any failure — with no
 * signal anywhere that compression had been skipped. That is why photos
 * kept arriving at full camera resolution (3000-4000px, multi-MB) well
 * after this file was deployed: the fast path worked for some devices and
 * silently no-op'd for others. Two changes fix that:
 *   1. A second decode path (`<img> + decode()`) is tried before giving up,
 *      since it succeeds on some inputs where createImageBitmap does not.
 *   2. `compressImageForUpload` now returns whether compression actually
 *      happened, so callers can log/report the miss instead of it vanishing
 *      silently. A server-side safety net (see app/api/posts/process-media)
 *      re-compresses anything that still lands oversized, so a full skip
 *      here is no longer the end of the story.
 */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const SKIP_IF_UNDER_BYTES = 400 * 1024; // already small, don't bother

export type CompressResult = {
  file: File;
  compressed: boolean;
  width: number | null;
  height: number | null;
};

async function decodeViaBitmap(
  file: File,
): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close: () => void } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      close: () => bitmap.close(),
    };
  } catch {
    return null;
  }
}

/** Fallback decode path for inputs createImageBitmap rejects on some devices. */
async function decodeViaImageElement(
  file: File,
): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close: () => void } | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

export async function compressImageForUpload(
  file: File,
): Promise<CompressResult> {
  if (file.type === "image/gif") {
    return { file, compressed: false, width: null, height: null };
  }
  if (file.size <= SKIP_IF_UNDER_BYTES) {
    return { file, compressed: false, width: null, height: null };
  }

  const decoded =
    (await decodeViaBitmap(file)) ?? (await decodeViaImageElement(file));

  if (!decoded) {
    // Both decode paths failed — genuinely can't process this file client-side.
    // Server-side safety net will catch it after upload.
    return { file, compressed: false, width: null, height: null };
  }

  try {
    const { width, height, draw, close } = decoded;
    const longest = Math.max(width, height);

    if (longest <= MAX_DIMENSION && file.size <= 2 * 1024 * 1024) {
      close();
      return { file, compressed: false, width, height };
    }

    const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      close();
      return { file, compressed: false, width, height };
    }
    draw(ctx, targetW, targetH);
    close();

    // PNG stays PNG (keeps transparency); everything else becomes JPEG.
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) {
      return { file, compressed: false, width, height };
    }

    const ext = outType === "image/png" ? "png" : "jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + `.${ext}`;
    const out = new File([blob], name, { type: outType });
    return { file: out, compressed: true, width: targetW, height: targetH };
  } catch {
    // Any failure past decode (canvas/toBlob) -- fall back to the
    // original file rather than blocking the post.
    return { file, compressed: false, width: null, height: null };
  }
}

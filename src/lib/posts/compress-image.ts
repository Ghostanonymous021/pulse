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
 */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const SKIP_IF_UNDER_BYTES = 400 * 1024; // already small, don't bother

export async function compressImageForUpload(file: File): Promise<File> {
  if (file.type === "image/gif") return file;
  if (file.size <= SKIP_IF_UNDER_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);

    if (longest <= MAX_DIMENSION && file.size <= 2 * 1024 * 1024) {
      bitmap.close();
      return file;
    }

    const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    // PNG stays PNG (keeps transparency); everything else becomes JPEG.
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const ext = outType === "image/png" ? "png" : "jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + `.${ext}`;
    return new File([blob], name, { type: outType });
  } catch {
    // Any failure (unsupported format, decode error) -- fall back to
    // the original file rather than blocking the post.
    return file;
  }
}

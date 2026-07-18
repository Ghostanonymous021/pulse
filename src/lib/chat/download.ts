/**
 * WhatsApp-like save/download helpers for chat media.
 * Never auto-trigger — only on explicit user action.
 */

export async function downloadFromUrl(
  url: string,
  fileName: string,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Nao foi possivel descarregar.");
  const blob = await res.blob();
  await saveBlob(blob, fileName);
}

export async function saveBlob(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, {
    type: blob.type || "application/octet-stream",
  });

  // Prefer share sheet (mobile: "Guardar imagem" / Files)
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({ files: [file], title: fileName });
      return;
    }
  } catch (e) {
    // User cancelled share — don't fall through to forced download
    if (e instanceof Error && e.name === "AbortError") return;
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName || "ficheiro";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

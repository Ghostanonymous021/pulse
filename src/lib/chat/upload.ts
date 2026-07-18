/**
 * Chat media upload with progress + AbortSignal (WhatsApp-like cancel).
 * Uses XHR against Supabase Storage REST — fetch alone has no upload progress.
 */

export type UploadProgress = (percent: number) => void;

export async function uploadChatFile(opts: {
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  bucket: string;
  path: string;
  file: File | Blob;
  contentType?: string;
  onProgress?: UploadProgress;
  signal?: AbortSignal;
}): Promise<void> {
  const {
    supabaseUrl,
    anonKey,
    accessToken,
    bucket,
    path,
    file,
    contentType,
    onProgress,
    signal,
  } = opts;

  const url = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader(
      "Content-Type",
      contentType ||
        (file instanceof File ? file.type : "") ||
        "application/octet-stream",
    );
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (e) => {
      if (!onProgress) return;
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(
          new Error(
            xhr.responseText?.slice(0, 200) || `Upload falhou (${xhr.status})`,
          ),
        );
      }
    };

    xhr.onerror = () => reject(new Error("Falha de rede no upload."));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener(
        "abort",
        () => {
          xhr.abort();
        },
        { once: true },
      );
    }

    xhr.send(file);
  });
}

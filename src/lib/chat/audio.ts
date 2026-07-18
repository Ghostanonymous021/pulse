/** Helpers for voice notes (MediaRecorder). */

export function pickAudioMime(): { mime: string; ext: string } {
  if (typeof MediaRecorder === "undefined") {
    return { mime: "audio/webm", ext: "webm" };
  }
  const candidates: { mime: string; ext: string }[] = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
    { mime: "audio/ogg", ext: "ogg" },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: "", ext: "webm" };
}

export function formatDuration(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function humanizeMicError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "Permite o microfone nas definições do browser para gravar áudio.";
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return "Nenhum microfone encontrado.";
    }
    if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      return "O microfone está a ser usado por outra app.";
    }
    if (err.name === "SecurityError") {
      return "Microfone bloqueado neste contexto (usa HTTPS).";
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "Não foi possível gravar áudio.";
}

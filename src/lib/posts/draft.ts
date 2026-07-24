/**
 * Rascunho automatico da composicao (client-only).
 *
 * Texto + tempo de vida vao em localStorage (pequenos, sincronos).
 * Imagens vao em IndexedDB (blobs binarios — localStorage teria quota
 * insuficiente e obrigaria a base64, que e ~33% maior e mais lento).
 *
 * Sem servidor envolvido: um rascunho nunca sai do dispositivo.
 */

import type { LifespanPreset } from "@/lib/posts/lifespan";

const META_KEY = "pulse:compose_draft_meta";
const DB_NAME = "pulse-compose-draft";
const DB_VERSION = 1;
const STORE_NAME = "images";

export type ComposeDraftMeta = {
  body: string;
  lifespanPreset: LifespanPreset;
  customDateIso: string | null;
  /** Order + count of images kept — matches keys in the IndexedDB store. */
  imageKeys: string[];
  savedAt: number;
};

export type ComposeDraftImage = {
  key: string;
  blob: Blob;
  name: string;
  type: string;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function readMeta(): ComposeDraftMeta | null {
  if (!hasWindow()) return null;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ComposeDraftMeta;
    if (typeof parsed?.body !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeMeta(meta: ComposeDraftMeta) {
  if (!hasWindow()) return;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* quota / private mode — draft just won't persist */
  }
}

function clearMeta() {
  if (!hasWindow()) return;
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    /* ignore */
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasWindow() || !("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function clearImages(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function putImages(images: ComposeDraftImage[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await clearImages();
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const img of images) {
        store.put({ blob: img.blob, name: img.name, type: img.type }, img.key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function getImages(
  keys: string[],
): Promise<Map<string, { blob: Blob; name: string; type: string }>> {
  const map = new Map<string, { blob: Blob; name: string; type: string }>();
  const db = await openDb();
  if (!db || !keys.length) return map;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      let remaining = keys.length;
      for (const key of keys) {
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result) map.set(key, req.result);
          remaining -= 1;
          if (remaining <= 0) resolve();
        };
        req.onerror = () => {
          remaining -= 1;
          if (remaining <= 0) resolve();
        };
      }
      if (keys.length === 0) resolve();
    } catch {
      resolve();
    }
  });
  return map;
}

/** Save draft (debounced by the caller). Empty body + no images clears it. */
export async function saveComposeDraft(input: {
  body: string;
  lifespanPreset: LifespanPreset;
  customDate: Date | null;
  images: { file: File }[];
}): Promise<void> {
  const hasContent = input.body.trim().length > 0 || input.images.length > 0;
  if (!hasContent) {
    clearComposeDraft();
    return;
  }

  const imageKeys = input.images.map((_, i) => `img-${i}`);
  await putImages(
    input.images.map((img, i) => ({
      key: imageKeys[i],
      blob: img.file,
      name: img.file.name,
      type: img.file.type,
    })),
  );

  writeMeta({
    body: input.body,
    lifespanPreset: input.lifespanPreset,
    customDateIso: input.customDate ? input.customDate.toISOString() : null,
    imageKeys,
    savedAt: Date.now(),
  });
}

/** Restore draft on mount. Returns null if there is nothing saved. */
export async function loadComposeDraft(): Promise<{
  body: string;
  lifespanPreset: LifespanPreset;
  customDate: Date | null;
  images: File[];
} | null> {
  const meta = readMeta();
  if (!meta) return null;

  const stored = await getImages(meta.imageKeys);
  const images: File[] = [];
  for (const key of meta.imageKeys) {
    const entry = stored.get(key);
    if (entry) {
      images.push(
        new File([entry.blob], entry.name || "imagem.jpg", {
          type: entry.type || "image/jpeg",
        }),
      );
    }
  }

  return {
    body: meta.body,
    lifespanPreset: meta.lifespanPreset,
    customDate: meta.customDateIso ? new Date(meta.customDateIso) : null,
    images,
  };
}

/** Called after publish or explicit discard. */
export function clearComposeDraft(): void {
  clearMeta();
  void clearImages();
}

export function hasComposeDraft(): boolean {
  return readMeta() !== null;
}

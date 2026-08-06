import { useSyncExternalStore } from "react";

const KEY = "crapp-avatars-v1";
const listeners = new Set<() => void>();
let cache: Record<string, string> | undefined;

function read(): Record<string, string> {
  if (cache) return cache;
  if (typeof window === "undefined") return {};
  try {
    cache = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Record<string, string>) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota o storage non disponibile */
  }
  listeners.forEach((l) => l());
}

const EMPTY: Record<string, string> = {};

export function useAvatars(): Record<string, string> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => read(),
    () => EMPTY,
  );
}

export function useAvatar(id: string | undefined): string | null {
  const all = useAvatars();
  return id ? (all[id] ?? null) : null;
}

export function rimuoviAvatar(id: string) {
  const next = { ...read() };
  delete next[id];
  write(next);
}

export function salvaAvatar(id: string, dataUrl: string) {
  write({ ...read(), [id]: dataUrl });
}

/** Ridimensiona e comprime l'immagine scelta per stare in localStorage. */
export function fileToAvatar(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lettura file fallita"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Immagine non valida"));
      img.onload = () => {
        const lato = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas non disponibile"));
        ctx.drawImage(
          img,
          (img.width - lato) / 2,
          (img.height - lato) / 2,
          lato,
          lato,
          0,
          0,
          size,
          size,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

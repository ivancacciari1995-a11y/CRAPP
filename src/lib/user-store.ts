import { useSyncExternalStore } from "react";
import { giocatori, type Giocatore } from "./crapp-data";
import { conInfortuni, useInfortuniERitardi } from "./infortuni";

const KEY = "crapp-user-v1";
const listeners = new Set<() => void>();
let cache: string | null | undefined = undefined;

function read(): string | null {
  if (cache !== undefined) return cache;
  if (typeof window === "undefined") return null;
  try {
    cache = window.localStorage.getItem(KEY);
  } catch {
    cache = null;
  }
  return cache;
}

function write(next: string | null) {
  cache = next;
  try {
    if (next) window.localStorage.setItem(KEY, next);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage non disponibile */
  }
  listeners.forEach((l) => l());
}

export function impostaGiocatore(id: string) {
  write(id);
}

export function resetGiocatore() {
  write(null);
}

/** Solo lettura locale: nessuna dipendenza da React Query (usabile fuori dal provider). */
export function useGiocatoreBase(): Giocatore | null {
  const id = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => read(),
    () => null,
  );
  return id ? (giocatori.find((x) => x.id === id) ?? null) : null;
}

export function useGiocatoreCorrente(): Giocatore | null {
  const g = useGiocatoreBase();
  const { infortuni, ritardi } = useInfortuniERitardi();
  return g ? conInfortuni(g, infortuni, ritardi) : null;
}

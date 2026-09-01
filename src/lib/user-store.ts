import { useSyncExternalStore } from "react";
import { giocatori, type Giocatore } from "./crapp-data";
import { useIo } from "./rosa";

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

/** Id del giocatore collegato al dispositivo (localStorage). */
export function useGiocatoreId(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => read(),
    () => null,
  );
}

/** Anagrafica base dal localStorage: le statistiche restano a zero finché non passa da `useIo`. */
export function useGiocatoreBase(): Giocatore | null {
  const id = useGiocatoreId();
  return id ? (giocatori.find((x) => x.id === id) ?? null) : null;
}

/** Giocatore corrente con statistiche calcolate da dati reali (presenze, MVP, badge, …). */
export function useGiocatoreCorrente(): Giocatore | null {
  return useIo();
}

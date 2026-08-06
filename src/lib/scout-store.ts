import { useSyncExternalStore } from "react";
import { giocatori, classifica, type Giocatore, type RigaClassifica } from "./crapp-data";

export type AzioneTipo =
  | "attacco"
  | "ace"
  | "muro"
  | "errore"
  | "punto_avv"
  | "errore_avv";

export const azioniMeta: Record<
  AzioneTipo,
  { label: string; short: string; nostro: boolean; richiedeGiocatore: boolean; className: string }
> = {
  attacco: { label: "Punto attacco", short: "Punto", nostro: true, richiedeGiocatore: true, className: "bg-accent text-accent-foreground" },
  ace: { label: "Ace", short: "Ace", nostro: true, richiedeGiocatore: true, className: "bg-success text-success-foreground" },
  muro: { label: "Muro", short: "Muro", nostro: true, richiedeGiocatore: true, className: "bg-info text-info-foreground" },
  errore: { label: "Errore nostro", short: "Errore", nostro: false, richiedeGiocatore: true, className: "bg-destructive text-destructive-foreground" },
  punto_avv: { label: "Punto avversario", short: "Punto avv.", nostro: false, richiedeGiocatore: false, className: "bg-muted text-muted-foreground" },
  errore_avv: { label: "Errore avversario", short: "Err. avv.", nostro: true, richiedeGiocatore: false, className: "bg-secondary text-foreground" },
};

export type Azione = {
  id: string;
  tipo: AzioneTipo;
  giocatoreId?: string;
  set: number;
  ts: number;
};

export type ScoutMatch = {
  id: string;
  data: string;
  avversario: string;
  casa: boolean;
  setNostri: number;
  setLoro: number;
  parziali: Array<[number, number]>;
  mvp: string;
  azioni: Azione[];
};

const KEY = "crapp-scout-v1";

let cache: ScoutMatch[] | null = null;
const listeners = new Set<() => void>();

function read(): ScoutMatch[] {
  if (cache) return cache;
  if (typeof window === "undefined") return (cache = []);
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as ScoutMatch[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: ScoutMatch[]) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage non disponibile */
  }
  listeners.forEach((l) => l());
}

export function salvaScoutMatch(m: ScoutMatch) {
  write([m, ...read()]);
}

export function eliminaScoutMatch(id: string) {
  write(read().filter((m) => m.id !== id));
}

export function useScoutMatches(): ScoutMatch[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => read(),
    () => [],
  );
}

/** Somma delle azioni di un match per giocatore. */
export function totaliPerGiocatore(azioni: Azione[]) {
  const out = new Map<string, { punti: number; ace: number; muri: number; errori: number }>();
  for (const a of azioni) {
    if (!a.giocatoreId) continue;
    const cur = out.get(a.giocatoreId) ?? { punti: 0, ace: 0, muri: 0, errori: 0 };
    if (a.tipo === "attacco") cur.punti += 1;
    if (a.tipo === "ace") {
      cur.ace += 1;
      cur.punti += 1;
    }
    if (a.tipo === "muro") {
      cur.muri += 1;
      cur.punti += 1;
    }
    if (a.tipo === "errore") cur.errori += 1;
    out.set(a.giocatoreId, cur);
  }
  return out;
}

/** Totali di squadra ricavati dallo scout (dato tecnico, non personale). */
export function totaliSquadra(matches: ScoutMatch[]) {
  const out = { punti: 0, ace: 0, muri: 0, errori: 0 };
  for (const m of matches) {
    for (const t of totaliPerGiocatore(m.azioni).values()) {
      out.punti += t.punti;
      out.ace += t.ace;
      out.muri += t.muri;
      out.errori += t.errori;
    }
  }
  return out;
}

/** Presenze e MVP ricavati dalle partite scoutate: nessuna statistica individuale offensiva.
 *  `mvpPerMatch` mappa idPartita -> nome dell'MVP eletto dalla squadra. */
export function giocatoriConScout(
  matches: ScoutMatch[],
  mvpPerMatch: Record<string, string> = {},
): Giocatore[] {
  return giocatori.map((g) => {
    let presenze = 0;
    let mvp = 0;
    for (const m of matches) {
      if (totaliPerGiocatore(m.azioni).has(g.id)) presenze += 1;
      if (mvpPerMatch[m.id] === g.nome) mvp += 1;
    }
    return {
      ...g,
      mvp: g.mvp + mvp,
      presenze: g.presenze + presenze,
      totaliEventi: g.totaliEventi + matches.length,
    };
  });
}

/** Classifica demo aggiornata con i match scoutati (solo la nostra riga). */
export function classificaConScout(matches: ScoutMatch[]): RigaClassifica[] {
  if (matches.length === 0) return classifica;
  const agg = matches.reduce(
    (s, m) => {
      const vinta = m.setNostri > m.setLoro;
      s.giocate += 1;
      s.vinte += vinta ? 1 : 0;
      s.perse += vinta ? 0 : 1;
      s.setFatti += m.setNostri;
      s.setSubiti += m.setLoro;
      s.punti += vinta ? (m.setLoro <= 1 ? 3 : 2) : m.setLoro === 3 && m.setNostri === 2 ? 1 : 0;
      return s;
    },
    { giocate: 0, vinte: 0, perse: 0, setFatti: 0, setSubiti: 0, punti: 0 },
  );
  return classifica
    .map((r) =>
      r.squadra === "CRAP Volley"
        ? {
            ...r,
            giocate: r.giocate + agg.giocate,
            vinte: r.vinte + agg.vinte,
            perse: r.perse + agg.perse,
            setFatti: r.setFatti + agg.setFatti,
            setSubiti: r.setSubiti + agg.setSubiti,
            punti: r.punti + agg.punti,
          }
        : r,
    )
    .sort((a, b) => b.punti - a.punti || b.setFatti - b.setSubiti - (a.setFatti - a.setSubiti))
    .map((r, i) => ({ ...r, pos: i + 1 }));
}
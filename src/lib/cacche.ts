import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { oggiISO } from "./palloni-core";

/** Ora di apertura del sondaggio, il giorno stesso della partita. */
export const ORA_APERTURA_SONDAGGIO = 8;

/** Istante del fischio d'inizio: `oraEvento` mancante equivale a fine giornata (non chiude mai prima). */
function inizioPartita(dataEvento: string, oraEvento: string): number {
  return new Date(`${dataEvento}T${oraEvento || "23:59"}:00`).getTime();
}

/** Il sondaggio apre alle 8:00 del giorno della partita e chiude al fischio d'inizio. */
export function sondaggioAperto(
  dataEvento: string,
  oraEvento: string,
  adesso = new Date(),
): boolean {
  if (dataEvento !== oggiISO(adesso)) return false;
  const apertura = new Date(`${dataEvento}T00:00:00`);
  apertura.setHours(ORA_APERTURA_SONDAGGIO, 0, 0, 0);
  return (
    adesso.getTime() >= apertura.getTime() &&
    adesso.getTime() < inizioPartita(dataEvento, oraEvento)
  );
}

/**
 * True se il fischio d'inizio è già passato (oggi o in un giorno precedente): serve a
 * distinguere, nel messaggio mostrato quando il sondaggio è chiuso, "non ancora aperto"
 * da "già chiuso" — altrimenti dopo la partita si continuerebbe a dire "apre alle 8:00".
 */
export function sondaggioTerminato(
  dataEvento: string,
  oraEvento: string,
  adesso = new Date(),
): boolean {
  const oggi = oggiISO(adesso);
  if (dataEvento < oggi) return true;
  if (dataEvento > oggi) return false;
  return adesso.getTime() >= inizioPartita(dataEvento, oraEvento);
}

/** Sondaggio goliardico pre-partita: quante cacche prima del match di campionato. */
export type RigaCacche = {
  evento_id: string;
  giocatore_id: string;
  quantita: number;
};

export const CACCHE_KEY = ["cacche"] as const;

export function useCacche() {
  const query = useQuery({
    queryKey: CACCHE_KEY,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<RigaCacche[]> => {
      const { data, error } = await supabase
        .from("cacche_partita")
        .select("evento_id, giocatore_id, quantita");
      if (error) throw error;
      return (data ?? []) as RigaCacche[];
    },
  });
  return { ...query, righe: query.data ?? [] };
}

export function useSalvaCacche() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (riga: RigaCacche) => {
      const { error } = await supabase
        .from("cacche_partita")
        .upsert(riga, { onConflict: "evento_id,giocatore_id" });
      if (error) throw error;
      return riga;
    },
    onSuccess: (riga) => {
      qc.setQueryData<RigaCacche[]>(CACCHE_KEY, (prec) => {
        const altre = (prec ?? []).filter(
          (r) => !(r.evento_id === riga.evento_id && r.giocatore_id === riga.giocatore_id),
        );
        return [...altre, riga];
      });
    },
  });
}

export type StatCacche = {
  totale: number;
  giornate: number;
  media: number;
  record: number;
  /** Giornate con almeno 3 cacche: soglia del badge segreto. */
  giornateTop: number;
};

function arrotonda(n: number) {
  return Math.round(n * 10) / 10;
}

/** Statistiche per giocatore: giocatoreId -> conteggi. */
export function statisticheCacche(righe: RigaCacche[]): Record<string, StatCacche> {
  const out: Record<string, StatCacche> = {};
  for (const r of righe) {
    const cur = out[r.giocatore_id] ?? {
      totale: 0,
      giornate: 0,
      media: 0,
      record: 0,
      giornateTop: 0,
    };
    cur.totale += r.quantita;
    cur.giornate += 1;
    cur.record = Math.max(cur.record, r.quantita);
    if (r.quantita >= 3) cur.giornateTop += 1;
    out[r.giocatore_id] = cur;
  }
  for (const s of Object.values(out)) s.media = arrotonda(s.totale / s.giornate);
  return out;
}

/** Media di squadra di una singola partita. */
export function mediaPartita(righe: RigaCacche[], eventoId: string) {
  const dellaPartita = righe.filter((r) => r.evento_id === eventoId);
  if (dellaPartita.length === 0) return 0;
  return arrotonda(dellaPartita.reduce((s, r) => s + r.quantita, 0) / dellaPartita.length);
}

/** Media di squadra su tutte le partite censite. */
export function mediaStagione(righe: RigaCacche[]) {
  if (righe.length === 0) return 0;
  return arrotonda(righe.reduce((s, r) => s + r.quantita, 0) / righe.length);
}

/** Record assoluto della stagione: chi e quante. */
export function recordStagione(righe: RigaCacche[]): RigaCacche | null {
  return righe.reduce<RigaCacche | null>(
    (best, r) => (!best || r.quantita > best.quantita ? r : best),
    null,
  );
}

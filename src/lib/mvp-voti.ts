import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VotoMvp = {
  match_id: string;
  votante_id: string;
  votato_id: string;
  votato_nome: string;
};

/** Un voto come lo vede la squadra: senza votante (il voto è segreto). */
export type VotoMvpPubblico = Pick<VotoMvp, "match_id" | "votato_id" | "votato_nome">;

const CHIAVE = ["mvp-voti"] as const;
const chiaveMiei = (votanteId: string | undefined) => ["mvp-voti-miei", votanteId] as const;

/** Ore da aspettare dall'inizio della partita prima di poter votare l'MVP. */
export const ORE_ATTESA_MVP = 2;

/** Per quante ore resta aperto il voto, dall'apertura (DD-052). */
export const DURATA_VOTO_MVP_ORE = 24;

/** Il voto MVP apre 2 ore dopo l'inizio della partita. */
export function votoMvpAperto(data: string, ora: string, adesso = new Date()): boolean {
  const inizio = new Date(`${data}T${ora || "00:00"}:00`);
  if (Number.isNaN(inizio.getTime())) return false;
  return adesso.getTime() >= inizio.getTime() + ORE_ATTESA_MVP * 60 * 60_000;
}

/** Il voto si è chiuso: sono passate `DURATA_VOTO_MVP_ORE` ore dall'apertura. */
export function votoMvpChiuso(data: string, ora: string, adesso = new Date()): boolean {
  const inizio = new Date(`${data}T${ora || "00:00"}:00`);
  if (Number.isNaN(inizio.getTime())) return false;
  const ore = ORE_ATTESA_MVP + DURATA_VOTO_MVP_ORE;
  return adesso.getTime() >= inizio.getTime() + ore * 60 * 60_000;
}

/** Si può votare adesso: aperto e non ancora chiuso. */
export function votoMvpInCorso(data: string, ora: string, adesso = new Date()): boolean {
  return votoMvpAperto(data, ora, adesso) && !votoMvpChiuso(data, ora, adesso);
}

/** Tutti i voti MVP della squadra, senza chi li ha dati (poche righe, si carica tutto).
 *  Vengono dalla vista `mvp_voti_anonimi`: la tabella è leggibile solo dal votante (DD-052).
 *  Nessun polling: la lista si aggiorna dopo il proprio voto o al rientro sull'app. */
export function useVotiMvp() {
  return useQuery({
    queryKey: CHIAVE,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<VotoMvpPubblico[]> => {
      const { data, error } = await supabase
        .from("mvp_voti_anonimi")
        .select("match_id, votato_id, votato_nome");
      if (error) throw error;
      return (data ?? []) as VotoMvpPubblico[];
    },
  });
}

/** I voti che ho dato io: sono gli unici che la tabella mi lascia leggere. */
export function useMieiVotiMvp(votanteId: string | undefined) {
  return useQuery({
    queryKey: chiaveMiei(votanteId),
    enabled: !!votanteId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<VotoMvp[]> => {
      const { data, error } = await supabase
        .from("mvp_voti")
        .select("match_id, votante_id, votato_id, votato_nome")
        .eq("votante_id", votanteId!);
      if (error) throw error;
      return (data ?? []) as VotoMvp[];
    },
  });
}

/** Il voto è definitivo: un secondo voto sulla stessa partita viene rifiutato dal database. */
export function useVotaMvp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (voto: VotoMvp) => {
      const { error } = await supabase.from("mvp_voti").insert(voto);
      if (error) throw error;
      return voto;
    },
    // Aggiorna la cache localmente: nessuna rilettura dal database.
    onSuccess: (voto) => {
      qc.setQueryData<VotoMvp[]>(chiaveMiei(voto.votante_id), (prec) => [
        ...(prec ?? []).filter((v) => v.match_id !== voto.match_id),
        voto,
      ]);
      qc.setQueryData<VotoMvpPubblico[]>(CHIAVE, (prec) => [
        ...(prec ?? []),
        { match_id: voto.match_id, votato_id: voto.votato_id, votato_nome: voto.votato_nome },
      ]);
    },
  });
}

export type ConteggioMvp = { id: string; nome: string; voti: number };

/** Voti minimi in una partita perché l'MVP possa essere assegnato (un solo voto non decide). */
export const VOTI_MINIMI_MVP = 2;

/** Conteggio voti di una partita, dal più votato. */
export function conteggioPartita(voti: VotoMvpPubblico[], matchId: string): ConteggioMvp[] {
  const map = new Map<string, ConteggioMvp>();
  for (const v of voti) {
    if (v.match_id !== matchId) continue;
    const cur = map.get(v.votato_id) ?? { id: v.votato_id, nome: v.votato_nome, voti: 0 };
    cur.voti += 1;
    map.set(v.votato_id, cur);
  }
  return [...map.values()].sort((a, b) => b.voti - a.voti || a.nome.localeCompare(b.nome));
}

/**
 * MVP di una partita: chi ha il massimo dei voti. Con una parità in testa sono tutti MVP a pari
 * merito. Sotto il quorum (`VOTI_MINIMI_MVP` voti totali) nessuno lo è ancora.
 */
export function mvpPartita(voti: VotoMvpPubblico[], matchId: string): ConteggioMvp[] {
  const top = conteggioPartita(voti, matchId);
  const totaleVoti = top.reduce((s, c) => s + c.voti, 0);
  if (totaleVoti < VOTI_MINIMI_MVP) return [];
  return top.filter((c) => c.voti === top[0]!.voti);
}

/** «Anna», «Anna e Bruno», «Anna, Bruno e Carla». */
export function elencoNomi(nomi: string[]): string {
  if (nomi.length <= 1) return nomi.join("");
  return `${nomi.slice(0, -1).join(", ")} e ${nomi[nomi.length - 1]}`;
}

/** MVP per ogni partita votata: matchId -> nome (più nomi uniti se c'è una parità in testa). */
export function vincitoriMvp(voti: VotoMvpPubblico[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const matchId of new Set(voti.map((v) => v.match_id))) {
    const mvp = mvpPartita(voti, matchId);
    if (mvp.length > 0) out[matchId] = elencoNomi(mvp.map((c) => c.nome));
  }
  return out;
}

export function mioVoto(voti: VotoMvp[], matchId: string, votanteId: string) {
  return voti.find((v) => v.match_id === matchId && v.votante_id === votanteId) ?? null;
}

/**
 * MVP vinti per giocatore: una vittoria per ogni partita in cui è tra i più votati (in caso di
 * parità in testa il titolo va a tutti i pari merito; sotto il quorum a nessuno). Senza voti
 * restituisce una mappa vuota.
 */
export function mvpVintiPerGiocatore(voti: VotoMvpPubblico[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const matchId of new Set(voti.map((v) => v.match_id))) {
    for (const { id } of mvpPartita(voti, matchId)) out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

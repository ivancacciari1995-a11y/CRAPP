import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventi, type Evento } from "./eventi";

/** Minuti dopo i quali una sessione scout inattiva viene considerata libera. */
export const SCADENZA_MINUTI = 5;

export function dataOggi(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** La partita in programma oggi, se c'è. */
export function partitaDiOggi(eventi: Evento[], oggi = dataOggi()): Evento | null {
  return eventi.find((e) => e.tipo === "partita" && e.data === oggi) ?? null;
}

export type SessioneScout = {
  evento_id: string;
  giocatore_id: string;
  giocatore_nome: string;
  aggiornato_il: string;
};

export function sessioneScaduta(s: SessioneScout | null): boolean {
  if (!s) return true;
  const aggiornato = new Date(s.aggiornato_il).getTime();
  // Timestamp illeggibile: meglio liberare la sessione che lasciarla bloccata per sempre.
  if (Number.isNaN(aggiornato)) return true;
  return Date.now() - aggiornato > SCADENZA_MINUTI * 60_000;
}

export const SESSIONE_KEY = (eventoId: string) => ["scout-sessione", eventoId] as const;

/** Sessione condivisa: chi la tiene aperta lo vede chiunque, su qualsiasi dispositivo. */
async function leggiSessione(eventoId: string): Promise<SessioneScout | null> {
  const { data, error } = await supabase
    .from("scout_sessioni")
    .select("evento_id, giocatore_id, giocatore_nome, aggiornato_il")
    .eq("evento_id", eventoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function useSessioneScout(eventoId: string | null) {
  return useQuery({
    queryKey: SESSIONE_KEY(eventoId ?? "-"),
    enabled: !!eventoId,
    // Nessun push in tempo reale: si ricontrolla all'apertura/focus della pagina
    // o con il pulsante "Aggiorna" quando risulta occupato.
    staleTime: 30_000,
    queryFn: () => leggiSessione(eventoId!),
  });
}

/** Prende il controllo dello scout se libero o scaduto. Ritorna true se ottenuto. */
export function useApriSessioneScout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventoId: string; giocatoreId: string; nome: string }) => {
      const attuale = await leggiSessione(input.eventoId);
      if (attuale && !sessioneScaduta(attuale) && attuale.giocatore_id !== input.giocatoreId) {
        return false;
      }
      const { error } = await supabase.from("scout_sessioni").upsert(
        {
          evento_id: input.eventoId,
          giocatore_id: input.giocatoreId,
          giocatore_nome: input.nome,
          aggiornato_il: new Date().toISOString(),
        },
        { onConflict: "evento_id" },
      );
      if (error) throw error;
      return true;
    },
    onSuccess: (_ok, input) => {
      queryClient.invalidateQueries({ queryKey: SESSIONE_KEY(input.eventoId) });
    },
  });
}

export function useChiudiSessioneScout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventoId: string; giocatoreId: string }) => {
      const attuale = await leggiSessione(input.eventoId);
      if (attuale && attuale.giocatore_id === input.giocatoreId) {
        const { error } = await supabase
          .from("scout_sessioni")
          .delete()
          .eq("evento_id", input.eventoId);
        if (error) throw error;
      }
    },
    onSuccess: (_d, input) => {
      queryClient.invalidateQueries({ queryKey: SESSIONE_KEY(input.eventoId) });
    },
  });
}

/** Mantiene viva la sessione mentre lo scout è aperto. */
export function useHeartbeatScout(
  eventoId: string | null,
  giocatoreId: string | null,
  attivo: boolean,
) {
  useEffect(() => {
    if (!attivo || !eventoId || !giocatoreId) return;
    const id = window.setInterval(() => {
      void supabase
        .from("scout_sessioni")
        .update({ aggiornato_il: new Date().toISOString() })
        .eq("evento_id", eventoId)
        .eq("giocatore_id", giocatoreId);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [attivo, eventoId, giocatoreId]);
}

/** Versione SSR-safe: null finché il client non è montato. */
export function usePartitaDiOggi(): { pronto: boolean; partita: Evento | null } {
  const { eventi, isPending } = useEventi();
  const [montato, setMontato] = useState(false);
  useEffect(() => {
    setMontato(true);
  }, []);
  if (!montato || isPending) return { pronto: false, partita: null };
  return { pronto: true, partita: partitaDiOggi(eventi) };
}

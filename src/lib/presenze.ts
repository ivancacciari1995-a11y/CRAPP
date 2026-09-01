import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Stato } from "./crapp-data";
import type { Evento } from "./eventi";

export const PRESENZE_KEY = ["risposte-presenze"] as const;

/** eventoId -> giocatoreId -> stato */
export type MappaPresenze = Record<string, Record<string, Stato>>;

/** Allenamenti e partite CrAPP che contano per le statistiche di presenza. */
function eventiContanoPresenze(eventi: Evento[], giocatoreId?: string) {
  return eventi.filter(
    (e) =>
      (e.tipo === "partita" || e.tipo === "allenamento") &&
      (giocatoreId === undefined ||
        e.convocati.length === 0 ||
        e.convocati.includes(giocatoreId)),
  );
}

/** Presenze effettive (presente o in ritardo) su eventi CrAPP. */
export function contaPresenzeGiocatore(
  giocatoreId: string,
  eventi: Evento[],
  presenze: MappaPresenze,
): number {
  return eventiContanoPresenze(eventi, giocatoreId).filter((e) => {
    const stato = presenze[e.id]?.[giocatoreId];
    return stato === "presente" || stato === "ritardo";
  }).length;
}

/** Eventi CrAPP rilevanti per il denominatore presenze di un giocatore. */
export function totaliEventiGiocatore(giocatoreId: string, eventi: Evento[]): number {
  return eventiContanoPresenze(eventi, giocatoreId).length;
}

async function fetchPresenze(): Promise<MappaPresenze> {
  const { data, error } = await supabase
    .from("risposte_presenze")
    .select("evento_id, giocatore_id, stato");
  if (error) throw error;
  const mappa: MappaPresenze = {};
  for (const riga of data ?? []) {
    (mappa[riga.evento_id] ??= {})[riga.giocatore_id] = riga.stato as Stato;
  }
  return mappa;
}

/** Una lettura per sessione: le risposte cambiano poco durante la navigazione. */
export function useRispostePresenze() {
  const query = useQuery({ queryKey: PRESENZE_KEY, queryFn: fetchPresenze, staleTime: 5 * 60_000 });
  return { ...query, presenze: query.data ?? {} };
}

export function usePresenzeEvento(eventoId: string) {
  const { presenze, ...resto } = useRispostePresenze();
  return { ...resto, risposte: presenze[eventoId] ?? {} };
}

export function useSalvaPresenza() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventoId: string; giocatoreId: string; stato: Stato | null }) => {
      if (input.stato === null) {
        const { error } = await supabase
          .from("risposte_presenze")
          .delete()
          .eq("evento_id", input.eventoId)
          .eq("giocatore_id", input.giocatoreId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("risposte_presenze").upsert(
          {
            evento_id: input.eventoId,
            giocatore_id: input.giocatoreId,
            stato: input.stato,
            aggiornato_il: new Date().toISOString(),
          },
          { onConflict: "evento_id,giocatore_id" },
        );
        if (error) throw error;
      }
      return input;
    },
    // Scrittura unica + aggiornamento cache locale, nessuna rilettura.
    onSuccess: (input) => {
      queryClient.setQueryData<MappaPresenze>(PRESENZE_KEY, (prec) => {
        const mappa: MappaPresenze = { ...(prec ?? {}) };
        const evento = { ...(mappa[input.eventoId] ?? {}) };
        if (input.stato === null) delete evento[input.giocatoreId];
        else evento[input.giocatoreId] = input.stato;
        mappa[input.eventoId] = evento;
        return mappa;
      });
    },
  });
}

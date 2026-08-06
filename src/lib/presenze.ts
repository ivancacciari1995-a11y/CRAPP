import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Stato } from "./crapp-data";

export const PRESENZE_KEY = ["risposte-presenze"] as const;

/** eventoId -> giocatoreId -> stato */
export type MappaPresenze = Record<string, Record<string, Stato>>;

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

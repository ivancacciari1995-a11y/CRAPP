import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { completaTurni } from "./palloni-core";
import { useEventi } from "./eventi";

export const TURNI_KEY = ["turni-palloni"] as const;

type RigaTurno = {
  evento_id: string;
  giocatore_id: string;
  aggiornato_da: string | null;
};

async function fetchTurni(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("turni_palloni")
    .select("evento_id, giocatore_id, aggiornato_da");
  if (error) throw error;
  const mappa: Record<string, string> = {};
  for (const riga of (data ?? []) as RigaTurno[]) mappa[riga.evento_id] = riga.giocatore_id;
  return mappa;
}

/** Turni salvati + proposta automatica a rotazione per gli eventi non ancora assegnati. */
export function useTurniPalloni() {
  // Cambia raramente: una lettura per sessione è sufficiente.
  const query = useQuery({ queryKey: TURNI_KEY, queryFn: fetchTurni, staleTime: 30 * 60_000 });
  const { eventi } = useEventi();
  const salvati = query.data ?? {};
  return { ...query, salvati, turni: completaTurni(salvati, eventi) };
}

export function useAssegnaTurno() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventoId: string; giocatoreId: string; da: string | null }) => {
      const { error } = await supabase.from("turni_palloni").upsert(
        {
          evento_id: input.eventoId,
          giocatore_id: input.giocatoreId,
          aggiornato_da: input.da,
          aggiornato_il: new Date().toISOString(),
        },
        { onConflict: "evento_id" },
      );
      if (error) throw error;
      return input;
    },
    // Scrittura unica + aggiornamento cache locale, senza rilettura.
    onSuccess: (input) => {
      queryClient.setQueryData<Record<string, string>>(TURNI_KEY, (prec) => ({
        ...(prec ?? {}),
        [input.eventoId]: input.giocatoreId,
      }));
    },
  });
}

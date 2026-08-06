import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Azione } from "./scout-store";

/** Stato condiviso di uno scout in corso: chi prende il controllo riparte da qui. */
export type StatoScout = {
  azioni: Azione[];
  setChiusi: Array<[number, number]>;
  avversario: string;
  casa: boolean;
};

export const statoIniziale = (avversario: string, casa: boolean): StatoScout => ({
  azioni: [],
  setChiusi: [],
  avversario,
  casa,
});

export const SCOUT_STATO_KEY = (eventoId: string) => ["scout-stato", eventoId] as const;

export function useStatoScout(eventoId: string | null) {
  return useQuery({
    queryKey: SCOUT_STATO_KEY(eventoId ?? "-"),
    enabled: !!eventoId,
    staleTime: Infinity,
    queryFn: async (): Promise<StatoScout | null> => {
      if (!eventoId) return null;
      const { data, error } = await supabase
        .from("scout_live")
        .select("stato")
        .eq("evento_id", eventoId)
        .maybeSingle();
      if (error) throw error;
      const stato = data?.stato as StatoScout | undefined;
      if (!stato || !Array.isArray(stato.azioni)) return null;
      return stato;
    },
  });
}

export function useSalvaStatoScout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventoId: string; stato: StatoScout }) => {
      const { error } = await supabase.from("scout_live").upsert(
        {
          evento_id: input.eventoId,
          stato: JSON.parse(JSON.stringify(input.stato)),
          aggiornato_il: new Date().toISOString(),
        },
        { onConflict: "evento_id" },
      );
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      queryClient.setQueryData(SCOUT_STATO_KEY(input.eventoId), input.stato);
    },
  });
}

export function useCancellaStatoScout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventoId: string) => {
      const { error } = await supabase.from("scout_live").delete().eq("evento_id", eventoId);
      if (error) throw error;
      return eventoId;
    },
    onSuccess: (eventoId) => {
      queryClient.setQueryData(SCOUT_STATO_KEY(eventoId), null);
    },
  });
}

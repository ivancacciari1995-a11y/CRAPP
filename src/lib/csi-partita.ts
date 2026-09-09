import { useQuery } from "@tanstack/react-query";
import type { DettaglioPartitaCsi } from "./csi-core";

/**
 * Dettaglio di una singola gara CSI (formazioni, storico scontri diretti): una fetch in
 * più per partita, cache server 6h come `useCsi()`. Va usato solo quando l'utente apre il
 * dettaglio di una gara, mai in una lista: vedi docs/modules/collegamento-csi.md.
 */
export function useCsiPartita(matchId: string | undefined) {
  return useQuery<DettaglioPartitaCsi>({
    queryKey: ["csi-partita", matchId],
    queryFn: async () => {
      const res = await fetch(`/api/public/csi-partita/${matchId}`);
      if (!res.ok) throw new Error("csi-partita non disponibile");
      return res.json();
    },
    enabled: !!matchId,
    staleTime: 6 * 60 * 60_000,
    retry: 1,
  });
}

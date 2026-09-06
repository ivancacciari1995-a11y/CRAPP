import { useMemo } from "react";
import { useEventi } from "./eventi";
import { useRispostePresenze } from "./presenze";
import { useGiocatoriSquadra } from "./giocatori-squadra";
import {
  presenzeUltimoMese,
  presenzeUltimoMeseTutti,
  type StatistichePresenza,
} from "./presenze-mese-core";

/**
 * Percentuale di presenze dell'ultimo mese (30 giorni), utile per le convocazioni.
 * Usa solo cache già in memoria: nessuna query aggiuntiva. Il calcolo sta in
 * `presenze-mese-core.ts`, qui c'è solo il collegamento agli hook.
 */
export function usePresenzeUltimoMese(giocatoreId: string | undefined): StatistichePresenza {
  const { eventi } = useEventi();
  const { presenze } = useRispostePresenze();

  return useMemo(
    () => presenzeUltimoMese(giocatoreId, eventi, presenze),
    [eventi, presenze, giocatoreId],
  );
}

/** Percentuale presenze ultimi 30 giorni per tutti i giocatori (mappa per id). */
export function usePresenzeUltimoMeseTutti(): Record<string, StatistichePresenza> {
  const { eventi } = useEventi();
  const { presenze } = useRispostePresenze();
  const { righe: squadra } = useGiocatoriSquadra();

  return useMemo(() => {
    const idRosa = squadra.filter((g) => g.attivo).map((g) => g.id);
    return presenzeUltimoMeseTutti(eventi, presenze, idRosa);
  }, [eventi, presenze, squadra]);
}

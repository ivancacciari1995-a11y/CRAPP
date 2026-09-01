import { useMemo } from "react";
import { useEventi } from "./eventi";
import { useRispostePresenze } from "./presenze";
import { giocatori } from "./crapp-data";

/**
 * Percentuale di presenze dell'ultimo mese (30 giorni), utile per le convocazioni.
 * Usa solo cache già in memoria: nessuna query aggiuntiva.
 */
export function usePresenzeUltimoMese(giocatoreId: string | undefined) {
  const { eventi } = useEventi();
  const { presenze } = useRispostePresenze();

  return useMemo(() => {
    if (!giocatoreId) return { presenti: 0, totali: 0, percentuale: 0 };
    const oggi = new Date();
    const inizio = new Date(oggi);
    inizio.setDate(inizio.getDate() - 30);
    const da = inizio.toISOString().slice(0, 10);
    const a = oggi.toISOString().slice(0, 10);

    const rilevanti = eventi.filter(
      (e) =>
        (e.tipo === "partita" || e.tipo === "allenamento") &&
        e.data >= da &&
        e.data <= a &&
        (e.convocati.length === 0 || e.convocati.includes(giocatoreId)),
    );
    const presenti = rilevanti.filter((e) => {
      const stato = presenze[e.id]?.[giocatoreId];
      return stato === "presente" || stato === "ritardo";
    }).length;
    const totali = rilevanti.length;
    return {
      presenti,
      totali,
      percentuale: totali ? Math.round((presenti / totali) * 100) : 0,
    };
  }, [eventi, presenze, giocatoreId]);
}

/** Percentuale presenze ultimi 30 giorni per tutti i giocatori (mappa per id). */
export function usePresenzeUltimoMeseTutti(): Record<
  string,
  { presenti: number; totali: number; percentuale: number }
> {
  const { eventi } = useEventi();
  const { presenze } = useRispostePresenze();

  return useMemo(() => {
    const oggi = new Date();
    const inizio = new Date(oggi);
    inizio.setDate(inizio.getDate() - 30);
    const da = inizio.toISOString().slice(0, 10);
    const a = oggi.toISOString().slice(0, 10);

    const rilevanti = eventi.filter(
      (e) => (e.tipo === "partita" || e.tipo === "allenamento") && e.data >= da && e.data <= a,
    );

    const out: Record<string, { presenti: number; totali: number; percentuale: number }> = {};
    for (const e of rilevanti) {
      const ids = e.convocati.length > 0 ? e.convocati : giocatori.map((g) => g.id);
      for (const id of ids) {
        const rec = (out[id] ??= { presenti: 0, totali: 0, percentuale: 0 });
        rec.totali += 1;
        const stato = presenze[e.id]?.[id];
        if (stato === "presente" || stato === "ritardo") rec.presenti += 1;
      }
    }
    for (const rec of Object.values(out)) {
      rec.percentuale = rec.totali ? Math.round((rec.presenti / rec.totali) * 100) : 0;
    }
    return out;
  }, [eventi, presenze]);
}

import type { Evento } from "./eventi";
import type { MappaPresenze } from "./presenze";

/**
 * Calcolo puro della percentuale di presenze dell'ultimo mese, separato dagli hook
 * (`presenze-mese.ts`) per poterlo testare: le tre regole che decidono il numero —
 * finestra di 30 giorni, il ritardo che conta come presenza, `convocati` vuoto uguale
 * a tutta la rosa — stanno qui.
 */

export type StatistichePresenza = { presenti: number; totali: number; percentuale: number };

const NESSUNA: StatistichePresenza = { presenti: 0, totali: 0, percentuale: 0 };

/** Chi è arrivato in ritardo era comunque all'allenamento: conta come presente. */
const eraPresente = (stato: string | undefined) => stato === "presente" || stato === "ritardo";

/** Finestra di 30 giorni che si chiude oggi, in date ISO. */
export function finestraMese(oggi: Date = new Date()): { da: string; a: string } {
  const inizio = new Date(oggi);
  inizio.setDate(inizio.getDate() - 30);
  return { da: inizio.toISOString().slice(0, 10), a: oggi.toISOString().slice(0, 10) };
}

/** Partite e allenamenti dentro la finestra: gli altri eventi non contano. */
function eventiDelMese(eventi: Evento[], oggi: Date): Evento[] {
  const { da, a } = finestraMese(oggi);
  return eventi.filter(
    (e) => (e.tipo === "partita" || e.tipo === "allenamento") && e.data >= da && e.data <= a,
  );
}

function conPercentuale(presenti: number, totali: number): StatistichePresenza {
  return { presenti, totali, percentuale: totali ? Math.round((presenti / totali) * 100) : 0 };
}

/** Presenze dell'ultimo mese di un singolo giocatore. */
export function presenzeUltimoMese(
  giocatoreId: string | undefined,
  eventi: Evento[],
  presenze: MappaPresenze,
  oggi: Date = new Date(),
): StatistichePresenza {
  if (!giocatoreId) return NESSUNA;
  const rilevanti = eventiDelMese(eventi, oggi).filter(
    (e) => e.convocati.length === 0 || e.convocati.includes(giocatoreId),
  );
  const presenti = rilevanti.filter((e) => eraPresente(presenze[e.id]?.[giocatoreId])).length;
  return conPercentuale(presenti, rilevanti.length);
}

/**
 * Presenze dell'ultimo mese di tutta la rosa, in una mappa per id. Un evento senza
 * convocati vale per tutti gli attivi, uno con l'elenco solo per i convocati.
 */
export function presenzeUltimoMeseTutti(
  eventi: Evento[],
  presenze: MappaPresenze,
  idRosa: string[],
  oggi: Date = new Date(),
): Record<string, StatistichePresenza> {
  const out: Record<string, StatistichePresenza> = {};
  for (const e of eventiDelMese(eventi, oggi)) {
    for (const id of e.convocati.length > 0 ? e.convocati : idRosa) {
      const rec = (out[id] ??= { presenti: 0, totali: 0, percentuale: 0 });
      rec.totali += 1;
      if (eraPresente(presenze[e.id]?.[id])) rec.presenti += 1;
    }
  }
  for (const [id, rec] of Object.entries(out)) out[id] = conPercentuale(rec.presenti, rec.totali);
  return out;
}

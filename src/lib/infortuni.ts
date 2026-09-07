import { useMemo } from "react";
import type { Giocatore } from "./crapp-data";
import type { Evento } from "./eventi";
import { useEventi } from "./eventi";
import { dataOggi } from "./scout-live";
import { useRispostePresenze, type MappaPresenze } from "./presenze";

/** giocatoreId -> numero di eventi (allenamenti + partite) con stato "infortunato". */
export type ContoInfortuni = Record<string, number>;

/**
 * Un giocatore può segnarsi infortunato o in ritardo anche su un evento futuro
 * (l'UI lo permette finché l'evento non è passato): finché quell'evento non è
 * avvenuto davvero non deve contare per i badge, altrimenti si sbloccherebbero
 * in anticipo. Un evento non più in `eventi` (es. cancellato) non viene contato:
 * non potendo verificarne la data, si esclude per prudenza.
 */
function contaStato(
  presenze: MappaPresenze,
  stato: string,
  eventi: Evento[],
  oggi: string = dataOggi(),
): ContoInfortuni {
  const dataPerEvento = new Map(eventi.map((e) => [e.id, e.data]));
  const out: ContoInfortuni = {};
  for (const eventoId of Object.keys(presenze)) {
    const dataEvento = dataPerEvento.get(eventoId);
    if (dataEvento === undefined || dataEvento >= oggi) continue;
    const evento = presenze[eventoId] ?? {};
    for (const giocatoreId of Object.keys(evento)) {
      if (evento[giocatoreId] === stato) out[giocatoreId] = (out[giocatoreId] ?? 0) + 1;
    }
  }
  return out;
}

/** Conta gli infortuni dalla mappa presenze già in cache: ogni evento passato vale una volta sola. */
export function contaInfortuni(
  presenze: MappaPresenze,
  eventi: Evento[],
  oggi: string = dataOggi(),
): ContoInfortuni {
  return contaStato(presenze, "infortunato", eventi, oggi);
}

/** Conta i ritardi dalla stessa mappa presenze: ogni evento passato vale una volta sola. */
export function contaRitardi(
  presenze: MappaPresenze,
  eventi: Evento[],
  oggi: string = dataOggi(),
): ContoInfortuni {
  return contaStato(presenze, "ritardo", eventi, oggi);
}

export function conInfortuni<T extends Giocatore>(
  g: T,
  conto: ContoInfortuni,
  contoRitardi: ContoInfortuni = {},
): T {
  return {
    ...g,
    infortuni: conto[g.id] ?? g.infortuni ?? 0,
    ritardi: contoRitardi[g.id] ?? g.ritardi ?? 0,
  };
}

/** Nessuna query aggiuntiva: riusa le cache di risposte presenze ed eventi. */
export function useInfortuni(): ContoInfortuni {
  const { presenze } = useRispostePresenze();
  const { eventi } = useEventi();
  return useMemo(() => contaInfortuni(presenze, eventi), [presenze, eventi]);
}

/** Nessuna query aggiuntiva: riusa le cache di risposte presenze ed eventi. */
export function useRitardi(): ContoInfortuni {
  const { presenze } = useRispostePresenze();
  const { eventi } = useEventi();
  return useMemo(() => contaRitardi(presenze, eventi), [presenze, eventi]);
}

/** Un solo hook per entrambi i conteggi: evita hook extra nei componenti. */
export function useInfortuniERitardi(): { infortuni: ContoInfortuni; ritardi: ContoInfortuni } {
  const { presenze } = useRispostePresenze();
  const { eventi } = useEventi();
  return useMemo(
    () => ({
      infortuni: contaInfortuni(presenze, eventi),
      ritardi: contaRitardi(presenze, eventi),
    }),
    [presenze, eventi],
  );
}

import { useMemo } from "react";
import type { Giocatore } from "./crapp-data";
import { useRispostePresenze, type MappaPresenze } from "./presenze";

/** giocatoreId -> numero di eventi (allenamenti + partite) con stato "infortunato". */
export type ContoInfortuni = Record<string, number>;

function contaStato(presenze: MappaPresenze, stato: string): ContoInfortuni {
  const out: ContoInfortuni = {};
  for (const eventoId of Object.keys(presenze)) {
    const evento = presenze[eventoId] ?? {};
    for (const giocatoreId of Object.keys(evento)) {
      if (evento[giocatoreId] === stato) out[giocatoreId] = (out[giocatoreId] ?? 0) + 1;
    }
  }
  return out;
}

/** Conta gli infortuni dalla mappa presenze già in cache: ogni evento vale una volta sola. */
export function contaInfortuni(presenze: MappaPresenze): ContoInfortuni {
  return contaStato(presenze, "infortunato");
}

/** Conta i ritardi dalla stessa mappa presenze: ogni evento vale una volta sola. */
export function contaRitardi(presenze: MappaPresenze): ContoInfortuni {
  return contaStato(presenze, "ritardo");
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

/** Nessuna query aggiuntiva: riusa la cache delle risposte presenze. */
export function useInfortuni(): ContoInfortuni {
  const { presenze } = useRispostePresenze();
  return useMemo(() => contaInfortuni(presenze), [presenze]);
}

/** Nessuna query aggiuntiva: riusa la cache delle risposte presenze. */
export function useRitardi(): ContoInfortuni {
  const { presenze } = useRispostePresenze();
  return useMemo(() => contaRitardi(presenze), [presenze]);
}

/** Un solo hook per entrambi i conteggi: evita hook extra nei componenti. */
export function useInfortuniERitardi(): { infortuni: ContoInfortuni; ritardi: ContoInfortuni } {
  const { presenze } = useRispostePresenze();
  return useMemo(
    () => ({ infortuni: contaInfortuni(presenze), ritardi: contaRitardi(presenze) }),
    [presenze],
  );
}
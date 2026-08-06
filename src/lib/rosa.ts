import { useMemo } from "react";
import { giocatori, type Giocatore } from "./crapp-data";
import { giocatoriConScout, useScoutMatches } from "./scout-store";
import { useVotiMvp, vincitoriMvp } from "./mvp-voti";
import { mediePagelle, usePagelle } from "./pagelle";
import { statisticheCacche, useCacche } from "./cacche";
import { conteggioTurni } from "./palloni-core";
import { useTurniPalloni } from "./palloni";
import { useInfortuniERitardi } from "./infortuni";
import { useGiocatoreBase } from "./user-store";
import { useEventi } from "./eventi";
import { useRispostePresenze } from "./presenze";
import { obiettiviOrdinati } from "./obiettivi";

/**
 * Rosa completa con tutte le statistiche personali (presenze, MVP, media voto,
 * palloni, infortuni, ritardi, cacche). Usa solo cache già in memoria:
 * nessuna query aggiuntiva rispetto a quelle che l'app fa comunque.
 */
export function useRosa(): Giocatore[] {
  const scoutMatches = useScoutMatches();
  const voti = useVotiMvp();
  const { voti: pagelle } = usePagelle();
  const { righe: cacche } = useCacche();
  const { turni } = useTurniPalloni();
  const { infortuni, ritardi } = useInfortuniERitardi();

  const votiMvp = voti.data ?? [];

  return useMemo(() => {
    const medie = mediePagelle(pagelle);
    const statCacche = statisticheCacche(cacche);
    const palloni = conteggioTurni(turni);
    return giocatoriConScout(scoutMatches, vincitoriMvp(votiMvp)).map((g) => ({
      ...g,
      mediaVoto: medie[g.id]?.media ?? g.mediaVoto,
      palloni: palloni[g.id] ?? 0,
      cacche: statCacche[g.id]?.giornateTop ?? 0,
      cacchePartita: statCacche[g.id]?.media ?? 0,
      infortuni: infortuni[g.id] ?? 0,
      ritardi: ritardi[g.id] ?? 0,
    }));
  }, [scoutMatches, votiMvp, pagelle, cacche, turni, infortuni, ritardi]);
}

/** Il giocatore selezionato sul dispositivo, con le statistiche complete. */
export function useIo(): Giocatore | null {
  const base = useGiocatoreBase();
  const rosa = useRosa();
  if (!base) return null;
  return rosa.find((g) => g.id === base.id) ?? base;
}

/** Obiettivi collaborativi calcolati sui dati reali già in cache. */
export function useObiettivi() {
  const rosa = useRosa();
  const { eventi } = useEventi();
  const { presenze } = useRispostePresenze();
  const { voti: pagelle } = usePagelle();
  return obiettiviOrdinati(rosa, { eventi, presenze, pagelle });
}

export { giocatori };

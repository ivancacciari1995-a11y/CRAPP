import { useMemo } from "react";
import { nascitaPerId, type Giocatore } from "./crapp-data";
import { nomeCompleto, useGiocatoriSquadra } from "./giocatori-squadra";
import { mvpVintiPerGiocatore, useVotiMvp } from "./mvp-voti";
import { mediePagelle, usePagelle } from "./pagelle";
import { statisticheCacche, useCacche } from "./cacche";
import { conteggioTurni } from "./palloni-core";
import { useTurniPalloni } from "./palloni";
import { useInfortuniERitardi } from "./infortuni";
import { useGiocatoreId } from "./user-store";
import { useEventi } from "./eventi";
import { contaPresenzeGiocatore, totaliEventiGiocatore, useRispostePresenze } from "./presenze";
import { obiettiviOrdinati } from "./obiettivi";
import { useCsi } from "./csi";
import { partiteGiocate } from "./csi-core";

function iniziali(nome: string, cognome: string): string {
  return `${nome[0] ?? ""}${cognome[0] ?? ""}`.toUpperCase();
}

/**
 * Rosa completa con tutte le statistiche personali (presenze, MVP, media voto,
 * palloni, infortuni, ritardi, cacche). Legge l'anagrafica da `giocatori_squadra`
 * (DD-015): solo i giocatori attivi, gli altri restano nel database ma spariscono
 * dagli elenchi correnti. Usa solo cache già in memoria: nessuna query aggiuntiva
 * rispetto a quelle che l'app fa comunque.
 */
export function useRosa(): Giocatore[] {
  const { righe: squadra } = useGiocatoriSquadra();
  const voti = useVotiMvp();
  const { voti: pagelle } = usePagelle();
  const { righe: cacche } = useCacche();
  const { turni } = useTurniPalloni();
  const { infortuni, ritardi } = useInfortuniERitardi();
  const { eventi } = useEventi();
  const { presenze: mappaPresenze } = useRispostePresenze();

  const votiMvp = voti.data ?? [];

  return useMemo(() => {
    const medie = mediePagelle(pagelle);
    const statCacche = statisticheCacche(cacche);
    const palloni = conteggioTurni(turni);
    const mvpVinti = mvpVintiPerGiocatore(votiMvp);

    return squadra
      .filter((g) => g.attivo)
      .map((g) => ({
        id: g.id,
        nome: nomeCompleto(g),
        numero: g.numero,
        ruolo: g.ruolo,
        nascita: nascitaPerId[g.id] ?? "",
        iniziali: iniziali(g.nome, g.cognome),
        presenze: contaPresenzeGiocatore(g.id, eventi, mappaPresenze),
        totaliEventi: totaliEventiGiocatore(g.id, eventi),
        streak: 0,
        serieAllenamenti: 0,
        seriePartite: 0,
        serieConferme: 0,
        mvp: mvpVinti[g.id] ?? 0,
        mediaVoto: medie[g.id]?.media ?? 0,
        palloni: palloni[g.id] ?? 0,
        cacche: statCacche[g.id]?.giornateTop ?? 0,
        cacchePartita: statCacche[g.id]?.media ?? 0,
        infortuni: infortuni[g.id] ?? 0,
        ritardi: ritardi[g.id] ?? 0,
      }));
  }, [squadra, votiMvp, pagelle, cacche, turni, infortuni, ritardi, eventi, mappaPresenze]);
}

/** Il giocatore selezionato sul dispositivo, con le statistiche complete. */
export function useIo(): Giocatore | null {
  const id = useGiocatoreId();
  const rosa = useRosa();
  if (!id) return null;
  return rosa.find((g) => g.id === id) ?? null;
}

/** Obiettivi collaborativi calcolati sui dati reali già in cache. */
export function useObiettivi() {
  const rosa = useRosa();
  const { eventi } = useEventi();
  const { presenze } = useRispostePresenze();
  const { voti: pagelle } = usePagelle();
  const { data: csi } = useCsi();
  const vittorie = csi
    ? partiteGiocate(csi.partite).filter((p) => (p.setNostri ?? 0) > (p.setLoro ?? 0)).length
    : 0;
  return obiettiviOrdinati(rosa, { eventi, presenze, pagelle, vittorie });
}

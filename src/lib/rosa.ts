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
import {
  contaPresenzeGiocatore,
  serieConferme,
  serieConsecutiva,
  totaliEventiGiocatore,
  useRispostePresenze,
} from "./presenze";
import { obiettiviOrdinati } from "./obiettivi";
import { useCsi } from "./csi";
import { partiteGiocate } from "./csi-core";

function iniziali(nome: string, cognome: string): string {
  return `${nome[0] ?? ""}${cognome[0] ?? ""}`.toUpperCase();
}

/**
 * Solo anagrafica (id, nome, ruolo, numero, data di nascita) dei giocatori attivi — es.
 * per i compleanni nel Calendario o le liste presenze. A differenza di `useRosa` non
 * legge MVP, pagelle, cacche, palloni né infortuni: evita di montare quei cinque hook e
 * il relativo `useMemo` solo per l'anagrafica.
 */
export function useAnagraficaRosa(): Array<
  Pick<Giocatore, "id" | "nome" | "ruolo" | "numero" | "nascita">
> {
  const { righe: squadra } = useGiocatoriSquadra();
  return useMemo(
    () =>
      squadra
        .filter((g) => g.attivo)
        .map((g) => ({
          id: g.id,
          nome: nomeCompleto(g),
          ruolo: g.ruolo,
          numero: g.numero,
          nascita: nascitaPerId[g.id] ?? "",
        })),
    [squadra],
  );
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
  const { salvati: turniSalvati } = useTurniPalloni();
  const { infortuni, ritardi } = useInfortuniERitardi();
  const { eventi } = useEventi();
  const { presenze: mappaPresenze, tempi } = useRispostePresenze();

  const votiMvp = voti.data ?? [];

  return useMemo(() => {
    const medie = mediePagelle(pagelle);
    const statCacche = statisticheCacche(cacche);
    // Solo i turni confermati, non le proposte automatiche di completaTurni(): il badge deve
    // premiare chi ha davvero portato i palloni, non chi l'algoritmo di rotazione ha
    // scelto per un evento passato senza che nessuno confermasse nulla.
    const palloni = conteggioTurni(turniSalvati, eventi);
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
        streak: serieConsecutiva(g.id, eventi, mappaPresenze),
        serieAllenamenti: serieConsecutiva(g.id, eventi, mappaPresenze, "allenamento"),
        seriePartite: serieConsecutiva(g.id, eventi, mappaPresenze, "partita"),
        serieConferme: serieConferme(g.id, eventi, tempi),
        mvp: mvpVinti[g.id] ?? 0,
        mediaVoto: medie[g.id]?.media ?? 0,
        votiPagella: medie[g.id]?.voti ?? 0,
        palloni: palloni[g.id] ?? 0,
        cacche: statCacche[g.id]?.giornateTop ?? 0,
        cacchePartita: statCacche[g.id]?.media ?? 0,
        infortuni: infortuni[g.id] ?? 0,
        ritardi: ritardi[g.id] ?? 0,
      }));
  }, [
    squadra,
    votiMvp,
    pagelle,
    cacche,
    turniSalvati,
    infortuni,
    ritardi,
    eventi,
    mappaPresenze,
    tempi,
  ]);
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

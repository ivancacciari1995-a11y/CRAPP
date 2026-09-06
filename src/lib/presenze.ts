import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Stato } from "./crapp-data";
import type { Evento } from "./eventi";
import { aggiornaSerie } from "./serie";
import { dataOggi } from "./scout-live";

export const PRESENZE_KEY = ["risposte-presenze"] as const;

/** eventoId -> giocatoreId -> stato */
export type MappaPresenze = Record<string, Record<string, Stato>>;

/** eventoId -> giocatoreId -> istante della prima risposta (ISO). */
export type MappaTempiRisposta = Record<string, Record<string, string>>;

/** Allenamenti e partite CrAPP già passati, che contano per le statistiche di presenza. */
function eventiContanoPresenze(eventi: Evento[], giocatoreId?: string, oggi = dataOggi()) {
  return eventi.filter(
    (e) =>
      (e.tipo === "partita" || e.tipo === "allenamento") &&
      e.data < oggi &&
      (giocatoreId === undefined || e.convocati.length === 0 || e.convocati.includes(giocatoreId)),
  );
}

/** Presenze effettive (presente o in ritardo) su eventi CrAPP. */
export function contaPresenzeGiocatore(
  giocatoreId: string,
  eventi: Evento[],
  presenze: MappaPresenze,
  oggi: string = dataOggi(),
): number {
  return eventiContanoPresenze(eventi, giocatoreId, oggi).filter((e) => {
    const stato = presenze[e.id]?.[giocatoreId];
    return stato === "presente" || stato === "ritardo";
  }).length;
}

/** Eventi CrAPP rilevanti per il denominatore presenze di un giocatore. */
export function totaliEventiGiocatore(
  giocatoreId: string,
  eventi: Evento[],
  oggi: string = dataOggi(),
): number {
  return eventiContanoPresenze(eventi, giocatoreId, oggi).length;
}

/**
 * Chi va sollecitato per un evento: i giocatori attivi che non hanno ancora risposto, più
 * quelli che hanno risposto «forse». Funzione pura, come `avvisiPalloniEvento()` per i
 * palloni: la route `/api/public/sollecita-presenze` la chiama con i dati che ha già letto.
 */
export function destinatariSollecito(
  squadra: Array<{ id: string; attivo: boolean }>,
  risposte: Array<{ giocatore_id: string; stato: string }>,
): string[] {
  const stati = new Map(risposte.map((r) => [r.giocatore_id, r.stato]));
  return squadra
    .filter((g) => g.attivo)
    .filter((g) => {
      const stato = stati.get(g.id);
      return stato === undefined || stato === "forse";
    })
    .map((g) => g.id);
}

/**
 * Serie di presenze consecutive su eventi già passati, in ordine di data:
 * ogni presenza (o ritardo) vale +1, qualsiasi altra risposta — o nessuna
 * risposta — azzera la serie. Senza `tipo` conta partite e allenamenti insieme.
 */
export function serieConsecutiva(
  giocatoreId: string,
  eventi: Evento[],
  presenze: MappaPresenze,
  tipo?: "partita" | "allenamento",
  oggi: string = oggiIso(),
): number {
  return serieSu(giocatoreId, eventi, oggi, tipo, (e) => {
    const stato = presenze[e.id]?.[giocatoreId];
    return stato === "presente" || stato === "ritardo";
  });
}

const ORE_24 = 24 * 60 * 60 * 1000;

/**
 * Serie di conferme rapide: risposte arrivate entro 24 ore dalla convocazione
 * (`creatoIl` dell'evento). Gli eventi senza istante di creazione — quelli generati
 * dal client, non salvati a database — non spezzano la serie: vengono saltati.
 */
export function serieConferme(
  giocatoreId: string,
  eventi: Evento[],
  tempi: MappaTempiRisposta,
  oggi: string = oggiIso(),
): number {
  return serieSu(
    giocatoreId,
    eventi.filter((e) => e.creatoIl),
    oggi,
    undefined,
    (e) => {
      const risposto = tempi[e.id]?.[giocatoreId];
      return risposto !== undefined && Date.parse(risposto) - Date.parse(e.creatoIl!) <= ORE_24;
    },
  );
}

function oggiIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Scorre gli eventi già passati in ordine di data applicando la regola delle serie. */
function serieSu(
  giocatoreId: string,
  eventi: Evento[],
  oggi: string,
  tipo: "partita" | "allenamento" | undefined,
  onorato: (e: Evento) => boolean,
): number {
  return eventiContanoPresenze(eventi, giocatoreId, oggi)
    .filter((e) => tipo === undefined || e.tipo === tipo)
    .sort((a, b) => a.data.localeCompare(b.data))
    .reduce((serie, e) => aggiornaSerie(serie, onorato(e)), 0);
}

type LetturaPresenze = { presenze: MappaPresenze; tempi: MappaTempiRisposta };

async function fetchPresenze(): Promise<LetturaPresenze> {
  const { data, error } = await supabase
    .from("risposte_presenze")
    .select("evento_id, giocatore_id, stato, risposto_il");
  if (error) throw error;
  const presenze: MappaPresenze = {};
  const tempi: MappaTempiRisposta = {};
  for (const riga of data ?? []) {
    (presenze[riga.evento_id] ??= {})[riga.giocatore_id] = riga.stato as Stato;
    (tempi[riga.evento_id] ??= {})[riga.giocatore_id] = riga.risposto_il;
  }
  return { presenze, tempi };
}

/** Una lettura per sessione: le risposte cambiano poco durante la navigazione. */
export function useRispostePresenze() {
  const query = useQuery({ queryKey: PRESENZE_KEY, queryFn: fetchPresenze, staleTime: 5 * 60_000 });
  return { ...query, presenze: query.data?.presenze ?? {}, tempi: query.data?.tempi ?? {} };
}

export function usePresenzeEvento(eventoId: string) {
  const { presenze, ...resto } = useRispostePresenze();
  return { ...resto, risposte: presenze[eventoId] ?? {} };
}

/**
 * La cache delle presenze dopo una risposta salvata, senza rileggere il database.
 *
 * Due dettagli non sono cosmetici e non vanno persi (vedi `docs/modules/serie-presenze.md`):
 *
 * - l'istante si scrive **solo se manca** (`??=`), come fa il database, dove `risposto_il`
 *   non viene inviato sull'upsert e un trigger lo congela: è la prima risposta, non l'ultima,
 *   e un ripensamento non deve far ripartire il cronometro della serie "Conferme 24h";
 * - cancellare la risposta (`stato: null`) elimina **anche** l'istante, così se il giocatore
 *   risponde di nuovo il cronometro riparte davvero — ha ritirato la risposta.
 */
export function conRisposta(
  prec: LetturaPresenze | undefined,
  input: { eventoId: string; giocatoreId: string; stato: Stato | null },
  adesso: string = new Date().toISOString(),
): LetturaPresenze {
  const presenze: MappaPresenze = { ...(prec?.presenze ?? {}) };
  const tempi: MappaTempiRisposta = { ...(prec?.tempi ?? {}) };
  const stati = { ...(presenze[input.eventoId] ?? {}) };
  const istanti = { ...(tempi[input.eventoId] ?? {}) };
  if (input.stato === null) {
    delete stati[input.giocatoreId];
    delete istanti[input.giocatoreId];
  } else {
    stati[input.giocatoreId] = input.stato;
    istanti[input.giocatoreId] ??= adesso;
  }
  presenze[input.eventoId] = stati;
  tempi[input.eventoId] = istanti;
  return { presenze, tempi };
}

export function useSalvaPresenza() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventoId: string; giocatoreId: string; stato: Stato | null }) => {
      if (input.stato === null) {
        const { error } = await supabase
          .from("risposte_presenze")
          .delete()
          .eq("evento_id", input.eventoId)
          .eq("giocatore_id", input.giocatoreId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("risposte_presenze").upsert(
          {
            evento_id: input.eventoId,
            giocatore_id: input.giocatoreId,
            stato: input.stato,
            aggiornato_il: new Date().toISOString(),
          },
          { onConflict: "evento_id,giocatore_id" },
        );
        if (error) throw error;
      }
      return input;
    },
    // Scrittura unica + aggiornamento cache locale, nessuna rilettura.
    onSuccess: (input) => {
      queryClient.setQueryData<LetturaPresenze>(PRESENZE_KEY, (prec) => conRisposta(prec, input));
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Stato } from "./crapp-data";
import type { Evento } from "./eventi";
import { aggiornaSerie } from "./serie";

export const PRESENZE_KEY = ["risposte-presenze"] as const;

/** eventoId -> giocatoreId -> stato */
export type MappaPresenze = Record<string, Record<string, Stato>>;

/** eventoId -> giocatoreId -> istante della prima risposta (ISO). */
export type MappaTempiRisposta = Record<string, Record<string, string>>;

/** Allenamenti e partite CrAPP che contano per le statistiche di presenza. */
function eventiContanoPresenze(eventi: Evento[], giocatoreId?: string) {
  return eventi.filter(
    (e) =>
      (e.tipo === "partita" || e.tipo === "allenamento") &&
      (giocatoreId === undefined ||
        e.convocati.length === 0 ||
        e.convocati.includes(giocatoreId)),
  );
}

/** Presenze effettive (presente o in ritardo) su eventi CrAPP. */
export function contaPresenzeGiocatore(
  giocatoreId: string,
  eventi: Evento[],
  presenze: MappaPresenze,
): number {
  return eventiContanoPresenze(eventi, giocatoreId).filter((e) => {
    const stato = presenze[e.id]?.[giocatoreId];
    return stato === "presente" || stato === "ritardo";
  }).length;
}

/** Eventi CrAPP rilevanti per il denominatore presenze di un giocatore. */
export function totaliEventiGiocatore(giocatoreId: string, eventi: Evento[]): number {
  return eventiContanoPresenze(eventi, giocatoreId).length;
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
  return eventiContanoPresenze(eventi, giocatoreId)
    .filter((e) => (tipo === undefined || e.tipo === tipo) && e.data <= oggi)
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
      queryClient.setQueryData<LetturaPresenze>(PRESENZE_KEY, (prec) => {
        const presenze: MappaPresenze = { ...(prec?.presenze ?? {}) };
        const tempi: MappaTempiRisposta = { ...(prec?.tempi ?? {}) };
        const stati = { ...(presenze[input.eventoId] ?? {}) };
        const istanti = { ...(tempi[input.eventoId] ?? {}) };
        if (input.stato === null) {
          delete stati[input.giocatoreId];
          delete istanti[input.giocatoreId];
        } else {
          stati[input.giocatoreId] = input.stato;
          // Come a database: l'istante è quello della prima risposta, non dei ripensamenti.
          istanti[input.giocatoreId] ??= new Date().toISOString();
        }
        presenze[input.eventoId] = stati;
        tempi[input.eventoId] = istanti;
        return { presenze, tempi };
      });
    },
  });
}

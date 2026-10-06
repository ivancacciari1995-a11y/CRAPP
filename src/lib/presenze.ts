import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDataNumerica, type Stato } from "./crapp-data";
import type { Evento, EventoTipo } from "./eventi";
import { inRosa, type TipoMembro } from "./giocatori-squadra";
import { aggiornaSerie } from "./serie";
import { dataOggi } from "./scout-live";

export const PRESENZE_KEY = ["risposte-presenze"] as const;

/** eventoId -> giocatoreId -> stato */
export type MappaPresenze = Record<string, Record<string, Stato>>;

/** eventoId -> giocatoreId -> istante della prima risposta (ISO). */
export type MappaTempiRisposta = Record<string, Record<string, string>>;

/** Allenamenti e partite CrAPP già passati, che contano per le statistiche di presenza. */
function eventiContanoPresenze(
  eventi: Evento[],
  giocatoreId?: string,
  oggi = dataOggi(),
  tipo?: "partita" | "allenamento",
) {
  return eventi.filter(
    (e) =>
      (e.tipo === "partita" || e.tipo === "allenamento") &&
      (tipo === undefined || e.tipo === tipo) &&
      e.data < oggi &&
      (giocatoreId === undefined || e.convocati.length === 0 || e.convocati.includes(giocatoreId)),
  );
}

/**
 * Presenze effettive (presente o in ritardo) su eventi CrAPP. Senza eventi rilevanti
 * restituisce 0. `tipo` filtra a un solo tipo di evento (es. solo partite); di default
 * conta partite e allenamenti insieme, come il resto delle statistiche di presenza.
 */
export function contaPresenzeGiocatore(
  giocatoreId: string,
  eventi: Evento[],
  presenze: MappaPresenze,
  oggi: string = dataOggi(),
  tipo?: "partita" | "allenamento",
): number {
  return eventiContanoPresenze(eventi, giocatoreId, oggi, tipo).filter((e) => {
    const stato = presenze[e.id]?.[giocatoreId];
    return stato === "presente" || stato === "ritardo";
  }).length;
}

/**
 * Partite (non allenamenti) a cui il giocatore era presente o in ritardo: il dato giusto
 * per contesti legati alle prestazioni in campo (es. MVP), a differenza di
 * `totaliEventiGiocatore()` che è il denominatore delle presenze e include gli allenamenti.
 */
export function contaPartiteGiocate(
  giocatoreId: string,
  eventi: Evento[],
  presenze: MappaPresenze,
  oggi: string = dataOggi(),
): number {
  return contaPresenzeGiocatore(giocatoreId, eventi, presenze, oggi, "partita");
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
 * Se "infortunato" va offerto come risposta: sì per allenamenti e partite, no per gli
 * eventi extra-campo (`"evento"`, es. cena di squadra), dove l'infortunio non è una
 * risposta pertinente. Resta comunque visibile a chi ce l'ha già (dati storici, o un
 * evento cambiato tipo dopo la risposta), così può ancora toglierla.
 */
export function includeInfortunato(tipo: EventoTipo, statoAttuale?: Stato | null): boolean {
  return tipo !== "evento" || statoAttuale === "infortunato";
}

/**
 * Chi va sollecitato per un evento (DD-040): i destinatari dell'evento — i convocati, o tutta la
 * rosa se `convocati` è vuoto — che non hanno ancora risposto o hanno risposto «forse». Mai gli
 * allenatori (DD-034). Stessa regola del job automatico del database (`giocatori_destinatari_evento`
 * più `genera_solleciti_presenze`, migration M26): funzione pura, come `avvisiPalloniEvento()` per i
 * palloni, chiamata dalla route `/api/public/sollecita-presenze` con i dati che ha già letto.
 */
export function destinatariSollecito(
  squadra: Array<{ id: string; attivo: boolean; tipo: TipoMembro }>,
  risposte: Array<{ giocatore_id: string; stato: string }>,
  convocati: string[] = [],
): string[] {
  const stati = new Map(risposte.map((r) => [r.giocatore_id, r.stato]));
  // L'allenatore non risponde alle presenze, quindi non va sollecitato (DD-034).
  return squadra
    .filter(inRosa)
    .filter((g) => convocati.length === 0 || convocati.includes(g.id))
    .filter((g) => {
      const stato = stati.get(g.id);
      return stato === undefined || stato === "forse";
    })
    .map((g) => g.id);
}

/**
 * Titolo e corpo del sollecito, gli stessi del job automatico (migration M26). `da` è il nome di
 * chi preme il pulsante: compare solo nel sollecito manuale, come riga «Richiesta di».
 */
export function testoSollecito(
  evento: Pick<Evento, "titolo" | "data" | "ora" | "luogo">,
  stato: string | undefined,
  da?: string,
): { titolo: string; testo: string } {
  const luogo = evento.luogo.trim();
  return {
    titolo: `Conferma di partecipazione richiesta: ${evento.titolo}`,
    testo: [
      `Data: ${formatDataNumerica(evento.data)}`,
      `Ora: ${evento.ora}`,
      ...(luogo ? [`Luogo: ${luogo}`] : []),
      ...(da ? [`Richiesta di: ${da}`] : []),
      `Risposta attuale: ${stato === "forse" ? "forse" : "nessuna"}`,
      "Azione: indicare presente, assente o in ritardo",
    ].join("\n"),
  };
}

/**
 * Serie di presenze consecutive su eventi già passati, in ordine di data:
 * ogni presenza (o ritardo) vale +1, qualsiasi altra risposta — o nessuna
 * risposta — azzera la serie. Senza `tipo` conta partite e allenamenti insieme.
 *
 * Chi risulta infortunato non ci ha rinunciato: quell'evento è saltato, non conta
 * né come presenza né come assenza, e la serie resta congelata al valore di prima.
 */
export function serieConsecutiva(
  giocatoreId: string,
  eventi: Evento[],
  presenze: MappaPresenze,
  tipo?: "partita" | "allenamento",
  oggi: string = dataOggi(),
): number {
  return serieSu(
    giocatoreId,
    eventi.filter((e) => presenze[e.id]?.[giocatoreId] !== "infortunato"),
    oggi,
    tipo,
    (e) => {
      const stato = presenze[e.id]?.[giocatoreId];
      return stato === "presente" || stato === "ritardo";
    },
  );
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
 *   e un ripensamento non deve cambiare l'istante della prima risposta;
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Giocatore } from "./crapp-data";

export type EventoTipo = "partita" | "allenamento" | "evento" | "compleanno";

export type Evento = {
  id: string;
  tipo: EventoTipo;
  titolo: string;
  luogo: string;
  /** Link Google Maps del luogo; assente o vuoto = nessun link. */
  linkMaps?: string | undefined;
  data: string;
  ora: string;
  note: string;
  /** Giocatori convocati (vuoto = tutta la rosa). */
  convocati: string[];
  /** Solo per le partite: vale per il campionato CSI. */
  campionato: boolean;
  /** Solo per le partite: si gioca in casa (false = trasferta). */
  casa: boolean;
  /** Le pagelle di questa partita non accettano più voti. */
  pagelleChiuse: boolean;
  /** Quando l'evento è stato creato: è l'istante della convocazione.
   *  Assente sugli eventi generati dal client (compleanni, bozze non salvate). */
  creatoIl?: string | undefined;
};

export type RigaEvento = {
  id: string;
  tipo: string;
  titolo: string;
  luogo: string;
  link_maps?: string | null;
  data: string;
  ora: string;
  note: string | null;
  convocati: string[] | null;
  campionato: boolean;
  casa: boolean | null;
  pagelle_chiuse: boolean;
  creato_il?: string;
};

/** Conversione riga database -> modello applicativo (riusabile anche lato server). */
export function daRiga(r: RigaEvento): Evento {
  return {
    id: r.id,
    tipo: (r.tipo as EventoTipo) ?? "evento",
    titolo: r.titolo,
    luogo: r.luogo ?? "",
    linkMaps: r.link_maps ?? "",
    data: r.data,
    ora: r.ora ?? "",
    note: r.note ?? "",
    convocati: r.convocati ?? [],
    campionato: !!r.campionato,
    casa: r.casa ?? true,
    pagelleChiuse: !!r.pagelle_chiuse,
    creatoIl: r.creato_il,
  };
}

const COLONNE =
  "id, tipo, titolo, luogo, link_maps, data, ora, note, convocati, campionato, casa, pagelle_chiuse, creato_il";

/** Categoria mostrata in interfaccia: le amichevoli sono partite fuori campionato. */
export type CategoriaEvento = "allenamento" | "partita" | "amichevole" | "evento";

export function categoriaEvento(e: Pick<Evento, "tipo" | "campionato">): CategoriaEvento {
  if (e.tipo === "partita") return e.campionato ? "partita" : "amichevole";
  if (e.tipo === "allenamento") return "allenamento";
  return "evento";
}

export function daCategoria(c: CategoriaEvento): Pick<Evento, "tipo" | "campionato"> {
  if (c === "partita") return { tipo: "partita", campionato: true };
  if (c === "amichevole") return { tipo: "partita", campionato: false };
  return { tipo: c, campionato: false };
}

/**
 * Il link è accettato solo se punta a Google Maps (stesso criterio del CHECK su
 * `eventi_app.link_maps`): è un URL che gli utenti toccano, quindi niente `javascript:` né siti terzi.
 */
const LINK_MAPS =
  /^https:\/\/(maps\.app\.goo\.gl\/|goo\.gl\/maps\/|maps\.google\.[a-z.]+\/|(www\.)?google\.[a-z.]+\/maps)\S*$/;

export function linkMapsValido(url: string): boolean {
  return url.length <= 500 && LINK_MAPS.test(url);
}

export const EVENTI_KEY = ["eventi"] as const;

async function fetchEventi(): Promise<Evento[]> {
  const { data, error } = await supabase.from("eventi_app").select(COLONNE).order("data");
  if (error) throw error;
  return ((data ?? []) as RigaEvento[]).map(daRiga);
}

/** Una lettura per sessione: il calendario cambia raramente. */
export function useEventi() {
  const query = useQuery({ queryKey: EVENTI_KEY, queryFn: fetchEventi, staleTime: 10 * 60_000 });
  return { ...query, eventi: query.data ?? [] };
}

/** Il giocatore è tra i convocati (elenco vuoto = tutta la rosa). */
export function eConvocato(evento: Pick<Evento, "convocati">, giocatoreId: string): boolean {
  return evento.convocati.length === 0 || evento.convocati.includes(giocatoreId);
}

/**
 * Chi vede un evento: i convocati; se `convocati` è vuoto, tutta la rosa. Chi gestisce gli
 * eventi (admin e allenatori) li vede sempre, convocato o no.
 */
export function eventoVisibile(
  evento: Pick<Evento, "convocati">,
  giocatoreId: string | null,
  vedeTutto: boolean,
): boolean {
  if (vedeTutto) return true;
  if (evento.convocati.length === 0) return true;
  return giocatoreId !== null && eConvocato(evento, giocatoreId);
}

export function useEvento(id: string) {
  const { eventi, ...resto } = useEventi();
  return { ...resto, evento: eventi.find((e) => e.id === id) ?? null };
}

export function nuovoIdEvento() {
  return `e${Date.now().toString(36)}`;
}

export function eventoVuoto(): Evento {
  return {
    id: nuovoIdEvento(),
    tipo: "allenamento",
    titolo: "",
    luogo: "",
    linkMaps: "",
    data: new Date().toISOString().slice(0, 10),
    ora: "20:30",
    note: "",
    convocati: [],
    campionato: false,
    casa: true,
    pagelleChiuse: false,
  };
}

export function useSalvaEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (evento: Evento) => {
      const { error } = await supabase.from("eventi_app").upsert(
        {
          id: evento.id,
          tipo: evento.tipo,
          titolo: evento.titolo,
          luogo: evento.luogo,
          link_maps: evento.linkMaps?.trim() || null,
          data: evento.data,
          ora: evento.ora,
          note: evento.note,
          convocati: evento.convocati,
          campionato: evento.campionato,
          casa: evento.casa,
          pagelle_chiuse: evento.pagelleChiuse,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      return evento;
    },
    // Aggiornamento locale della cache: nessuna rilettura dal database.
    onSuccess: (evento) => {
      qc.setQueryData<Evento[]>(EVENTI_KEY, (prec) => {
        const altri = (prec ?? []).filter((e) => e.id !== evento.id);
        return [...altri, evento].sort((a, b) => a.data.localeCompare(b.data));
      });
    },
  });
}

export function useEliminaEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventi_app").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<Evento[]>(EVENTI_KEY, (prec) => (prec ?? []).filter((e) => e.id !== id));
    },
  });
}

/**
 * Compleanni della rosa, come eventi di calendario dell'anno indicato.
 *
 * Prende solo i tre campi che usa (non l'intero `Giocatore`): il Calendario li
 * legge da un'anagrafica leggera per non tirarsi dietro tutte le statistiche
 * (MVP, pagelle, cacche, palloni, infortuni) di `useRosa` solo per le date di
 * nascita.
 */
export function compleanniEventi(
  rosa: Array<Pick<Giocatore, "id" | "nome" | "nascita">>,
  anno = new Date().getFullYear(),
): Evento[] {
  return rosa
    .filter((g) => g.nascita)
    .map((g) => {
      const md = g.nascita.slice(5);
      const eta = anno - Number(g.nascita.slice(0, 4));
      return {
        id: `c-${g.id}`,
        tipo: "compleanno" as const,
        titolo: `Compleanno di ${g.nome}`,
        luogo: `Compie ${eta} anni`,
        data: `${anno}-${md}`,
        ora: "00:00",
        note: "",
        convocati: [],
        campionato: false,
        casa: true,
        pagelleChiuse: false,
      };
    })
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Rosa convocata per un evento: se non specificata vale tutta la rosa. */
export function convocatiEvento(evento: Evento | null, rosa: Giocatore[]) {
  return rosaConvocata(rosa, evento?.convocati ?? []);
}

/** Restringe una rosa ai convocati indicati: elenco vuoto = tutta la rosa. */
export function rosaConvocata<T extends { id: string }>(rosa: T[], convocati: string[]): T[] {
  if (convocati.length === 0) return rosa;
  return rosa.filter((g) => convocati.includes(g.id));
}

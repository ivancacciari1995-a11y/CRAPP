import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Giocatore } from "./crapp-data";

export type EventoTipo = "partita" | "allenamento" | "evento" | "compleanno";

export type Evento = {
  id: string;
  tipo: EventoTipo;
  titolo: string;
  luogo: string;
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
};

export type RigaEvento = {
  id: string;
  tipo: string;
  titolo: string;
  luogo: string;
  data: string;
  ora: string;
  note: string | null;
  convocati: string[] | null;
  campionato: boolean;
  casa: boolean | null;
  pagelle_chiuse: boolean;
};

/** Conversione riga database -> modello applicativo (riusabile anche lato server). */
export function daRiga(r: RigaEvento): Evento {
  return {
    id: r.id,
    tipo: (r.tipo as EventoTipo) ?? "evento",
    titolo: r.titolo,
    luogo: r.luogo ?? "",
    data: r.data,
    ora: r.ora ?? "",
    note: r.note ?? "",
    convocati: r.convocati ?? [],
    campionato: !!r.campionato,
    casa: r.casa ?? true,
    pagelleChiuse: !!r.pagelle_chiuse,
  };
}

const COLONNE =
  "id, tipo, titolo, luogo, data, ora, note, convocati, campionato, casa, pagelle_chiuse";

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
    luogo: "Palestra Comunale",
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

/** Compleanni della rosa, come eventi di calendario dell'anno indicato. */
export function compleanniEventi(rosa: Giocatore[], anno = new Date().getFullYear()): Evento[] {
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
  if (!evento || evento.convocati.length === 0) return rosa;
  return rosa.filter((g) => evento.convocati.includes(g.id));
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseNuoveTabelle } from "@/integrations/supabase/client-nuove-tabelle";
import { dividiNome, giocatori } from "./crapp-data";

/**
 * Anagrafica operativa della squadra (`giocatori_squadra`, migration M1). È la source of
 * truth per il collegamento account ↔ giocatore; `crapp-data.ts` resta il fallback finché
 * la migrazione non è completa (DD-016 regola 1).
 */
/** Chi gioca e chi allena (DD-034): l'allenatore ha uno slot ma non è nella rosa di gioco. */
export type TipoMembro = "giocatore" | "allenatore";

export type GiocatoreSquadra = {
  id: string;
  nome: string;
  cognome: string;
  /** 0 per l'allenatore, che non ha numero di maglia (a database è NULL). */
  numero: number;
  ruolo: string;
  authUserId: string | null;
  attivo: boolean;
  email: string | null;
  numeroTessera: string | null;
  dataTessera: string | null;
  /** Pubblica a tutta la rosa (M18): sincronizzata da `profili_giocatore.data_nascita`. */
  nascita: string | null;
  tipo: TipoMembro;
};

export type RigaGiocatoreSquadra = {
  id: string;
  nome: string;
  cognome: string;
  numero: number | null;
  ruolo: string;
  auth_user_id: string | null;
  attivo: boolean;
  email: string | null;
  numero_tessera: string | null;
  data_tessera: string | null;
  nascita: string | null;
  tipo: TipoMembro;
};

/** Ruoli ammessi in campo (pallavolo): usati per il menu a tendina del profilo squadra. */
export const RUOLI = ["Palleggiatore", "Banda", "Opposto", "Centrale", "Libero", "Jolly"] as const;

export const SQUADRA_KEY = ["giocatori-squadra"] as const;

/** Rosa di riserva quando il database non risponde o non è ancora popolato. */
export function rosaFallback(): GiocatoreSquadra[] {
  return giocatori.map((g) => ({
    ...dividiNome(g.nome),
    id: g.id,
    numero: g.numero,
    ruolo: g.ruolo,
    authUserId: null,
    attivo: true,
    email: null,
    numeroTessera: null,
    dataTessera: null,
    nascita: g.nascita,
    tipo: "giocatore" as const,
  }));
}

export function nomeCompleto(g: GiocatoreSquadra): string {
  return `${g.nome} ${g.cognome}`.trim();
}

export function isAllenatore(g: Pick<GiocatoreSquadra, "tipo"> | null | undefined): boolean {
  return g?.tipo === "allenatore";
}

/**
 * Rosa di gioco: giocatori attivi, senza allenatori (DD-034). È il filtro di presenze,
 * convocati, voti, palloni, classifiche e badge; gli allenatori compaiono solo dove la
 * specifica lo dice (Rosa di Squadra, compleanni, promemoria evento).
 */
export function inRosa(g: Pick<GiocatoreSquadra, "attivo" | "tipo">): boolean {
  return g.attivo && g.tipo === "giocatore";
}

/** Dove un giocatore ha il ruolo in campo, l'allenatore ha scritto «Allenatore». */
export function ruoloVisibile(g: Pick<GiocatoreSquadra, "ruolo" | "tipo">): string {
  return g.tipo === "allenatore" ? "Allenatore" : g.ruolo;
}

/** Lo slot già collegato a questo account, se esiste. */
export function slotDi(
  righe: GiocatoreSquadra[],
  utenteId: string | null,
): GiocatoreSquadra | null {
  if (!utenteId) return null;
  return righe.find((g) => g.authUserId === utenteId) ?? null;
}

/** Lo slot libero la cui email coincide con quella dell'account Google (case-insensitive). */
export function slotPerEmail(
  righe: GiocatoreSquadra[],
  email: string | null,
): GiocatoreSquadra | null {
  if (!email) return null;
  const cercata = email.trim().toLowerCase();
  return righe.find((g) => !g.authUserId && g.email?.trim().toLowerCase() === cercata) ?? null;
}

export const COLONNE_SQUADRA =
  "id, nome, cognome, numero, ruolo, auth_user_id, attivo, email, numero_tessera, data_tessera, nascita, tipo";

/** Conversione riga database -> modello applicativo (riusabile anche lato server). */
export function daRigaSquadra(r: RigaGiocatoreSquadra): GiocatoreSquadra {
  return {
    id: r.id,
    nome: r.nome,
    cognome: r.cognome,
    numero: r.numero ?? 0,
    ruolo: r.ruolo,
    authUserId: r.auth_user_id,
    attivo: r.attivo,
    email: r.email,
    numeroTessera: r.numero_tessera,
    dataTessera: r.data_tessera,
    nascita: r.nascita,
    tipo: r.tipo === "allenatore" ? "allenatore" : "giocatore",
  };
}

async function fetchSquadra(): Promise<GiocatoreSquadra[]> {
  const { data, error } = await supabaseNuoveTabelle
    .from("giocatori_squadra")
    .select(COLONNE_SQUADRA)
    .order("cognome")
    .order("nome");
  if (error) throw error;
  const righe = (data ?? []) as RigaGiocatoreSquadra[];
  return righe.map(daRigaSquadra);
}

/** Anagrafica squadra: una lettura per sessione, cambia raramente. */
export function useGiocatoriSquadra() {
  const query = useQuery({ queryKey: SQUADRA_KEY, queryFn: fetchSquadra, staleTime: 30 * 60_000 });
  const righe = query.data?.length ? query.data : rosaFallback();
  return { ...query, righe, daDatabase: !!query.data?.length };
}

/** Dati squadra: li gestisce solo un amministratore (DD-017). L'email è quella usata per
 * il collegamento automatico al primo accesso (DD-018), non il dato personale del profilo. */
export type DatiSquadra = Pick<
  GiocatoreSquadra,
  "nome" | "cognome" | "numero" | "ruolo" | "email" | "tipo"
>;

/**
 * Controlli che rispecchiano i vincoli della tabella (`numero > 0`, campi obbligatori):
 * meglio dirlo qui che far tornare un errore Postgres all'utente.
 * Restituisce il messaggio da mostrare, oppure `null` se va bene.
 */
export function validaDatiSquadra(dati: DatiSquadra): string | null {
  if (!dati.nome.trim()) return "Il nome non può essere vuoto.";
  if (!dati.cognome.trim()) return "Il cognome non può essere vuoto.";
  // L'allenatore non ha numero di maglia né ruolo in campo (DD-034).
  if (dati.tipo === "allenatore") {
    if (dati.email?.trim() && !dati.email.includes("@")) return "L'email non è valida.";
    return null;
  }
  if (!Number.isInteger(dati.numero) || dati.numero <= 0)
    return "Il numero di maglia deve essere maggiore di zero.";
  if (!dati.ruolo.trim()) return "Il ruolo non può essere vuoto.";
  if (dati.email?.trim() && !dati.email.includes("@")) return "L'email non è valida.";
  return null;
}

/** Il prossimo id libero nel formato `g<N>` richiesto dal vincolo della tabella. */
export function prossimoIdGiocatore(righe: GiocatoreSquadra[]): string {
  const max = righe.reduce((acc, g) => {
    const n = Number(g.id.slice(1));
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `g${max + 1}`;
}

/** Numeri di maglia doppi: il database li accetta, la squadra no. */
export function numeroGiaUsato(
  righe: GiocatoreSquadra[],
  giocatoreId: string,
  numero: number,
): boolean {
  return righe.some((g) => g.id !== giocatoreId && inRosa(g) && g.numero === numero);
}

/** Riga da scrivere: all'allenatore numero NULL e ruolo vuoto, il tipo non cambia qui. */
function rigaDatiSquadra(dati: DatiSquadra) {
  const allenatore = dati.tipo === "allenatore";
  return {
    nome: dati.nome.trim(),
    cognome: dati.cognome.trim(),
    numero: allenatore ? null : dati.numero,
    ruolo: allenatore ? "" : dati.ruolo.trim(),
    email: dati.email?.trim() || null,
  };
}

/** Modifica dei dati squadra. Solo un admin passa le policy di M1. */
export function useSalvaDatiSquadra() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { giocatoreId: string; dati: DatiSquadra }) => {
      const riga = rigaDatiSquadra(input.dati);
      const { error } = await supabaseNuoveTabelle
        .from("giocatori_squadra")
        .update(riga)
        .eq("id", input.giocatoreId);
      if (error) throw error;
      return { giocatoreId: input.giocatoreId, dati: { ...riga, numero: riga.numero ?? 0 } };
    },
    onSuccess: (input) => {
      queryClient.setQueryData<GiocatoreSquadra[]>(SQUADRA_KEY, (prec) =>
        (prec ?? []).map((g) => (g.id === input.giocatoreId ? { ...g, ...input.dati } : g)),
      );
    },
  });
}

/** Numero e data della tessera CSI, note solo dopo il tesseramento effettivo. */
export type DatiTesseramento = Pick<GiocatoreSquadra, "numeroTessera" | "dataTessera">;

/**
 * Registra numero e data della tessera CSI (roadmap v1.1). Campo puramente amministrativo:
 * il trigger di M8 lo rende scrivibile solo da un admin, il giocatore non può autodichiararsi
 * tesserato.
 */
export function useSalvaTesseramento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { giocatoreId: string; dati: DatiTesseramento }) => {
      const dati = {
        numero_tessera: input.dati.numeroTessera?.trim() || null,
        data_tessera: input.dati.dataTessera || null,
      };
      const { error } = await supabaseNuoveTabelle
        .from("giocatori_squadra")
        .update(dati)
        .eq("id", input.giocatoreId);
      if (error) throw error;
      return {
        giocatoreId: input.giocatoreId,
        dati: { numeroTessera: dati.numero_tessera, dataTessera: dati.data_tessera },
      };
    },
    onSuccess: (input) => {
      queryClient.setQueryData<GiocatoreSquadra[]>(SQUADRA_KEY, (prec) =>
        (prec ?? []).map((g) => (g.id === input.giocatoreId ? { ...g, ...input.dati } : g)),
      );
    },
  });
}

/**
 * Aggiunge un giocatore alla rosa (DD-017). Solo un admin passa le policy di M1.
 * L'id (`g<N>`) non è generato dal database: va calcolato con `prossimoIdGiocatore`
 * prima di chiamare questa mutazione.
 */
export function useAggiungiGiocatore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; dati: DatiSquadra }): Promise<GiocatoreSquadra> => {
      const riga = { id: input.id, tipo: input.dati.tipo, ...rigaDatiSquadra(input.dati) };
      const { error } = await supabaseNuoveTabelle.from("giocatori_squadra").insert(riga);
      if (error) throw error;
      // Le colonne non inviate hanno i default della tabella (M1): `attivo` true, il resto NULL.
      return {
        ...riga,
        numero: riga.numero ?? 0,
        authUserId: null,
        attivo: true,
        numeroTessera: null,
        dataTessera: null,
        nascita: null,
      };
    },
    // Aggiornamento locale della cache: nessuna rilettura, stesso ordine della query
    // (`.order("cognome").order("nome")`).
    onSuccess: (nuovo) => {
      queryClient.setQueryData<GiocatoreSquadra[]>(SQUADRA_KEY, (prec) =>
        [...(prec ?? []), nuovo].sort(
          (a, b) => a.cognome.localeCompare(b.cognome) || a.nome.localeCompare(b.nome),
        ),
      );
    },
  });
}

/**
 * Nome e cognome scritti dall'allenatore sul proprio slot (DD-034): per un giocatore sono
 * dati squadra dell'admin, e il trigger di M21 rifiuta la stessa scrittura.
 */
export function useSalvaNomeAllenatore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { giocatoreId: string; nome: string; cognome: string }) => {
      const dati = { nome: input.nome.trim(), cognome: input.cognome.trim() };
      if (!dati.nome) throw new Error("Il nome non può essere vuoto.");
      if (!dati.cognome) throw new Error("Il cognome non può essere vuoto.");
      const { error } = await supabaseNuoveTabelle
        .from("giocatori_squadra")
        .update(dati)
        .eq("id", input.giocatoreId);
      if (error) throw error;
      return { giocatoreId: input.giocatoreId, dati };
    },
    onSuccess: (input) => {
      queryClient.setQueryData<GiocatoreSquadra[]>(SQUADRA_KEY, (prec) =>
        (prec ?? []).map((g) => (g.id === input.giocatoreId ? { ...g, ...input.dati } : g)),
      );
    },
  });
}

/**
 * Attiva o disattiva un giocatore (es. ha lasciato la squadra): non elimina la riga, così
 * presenze, voti, pagelle e badge della stagione restano agganciati al suo id.
 */
export function useImpostaAttivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { giocatoreId: string; attivo: boolean }) => {
      const { error } = await supabaseNuoveTabelle
        .from("giocatori_squadra")
        .update({ attivo: input.attivo })
        .eq("id", input.giocatoreId);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      queryClient.setQueryData<GiocatoreSquadra[]>(SQUADRA_KEY, (prec) =>
        (prec ?? []).map((g) => (g.id === input.giocatoreId ? { ...g, attivo: input.attivo } : g)),
      );
    },
  });
}

/**
 * Libera uno slot occupato per errore (DD-016 regola 2, DD-017). Il giocatore
 * potrà ricollegarsi al primo accesso; i dati del profilo restano dove sono.
 */
export function useScollegaAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (giocatoreId: string) => {
      const { error } = await supabaseNuoveTabelle
        .from("giocatori_squadra")
        .update({ auth_user_id: null })
        .eq("id", giocatoreId);
      if (error) throw error;
      return giocatoreId;
    },
    onSuccess: (giocatoreId) => {
      queryClient.setQueryData<GiocatoreSquadra[]>(SQUADRA_KEY, (prec) =>
        (prec ?? []).map((g) => (g.id === giocatoreId ? { ...g, authUserId: null } : g)),
      );
    },
  });
}

/**
 * Collega l'account al giocatore scelto. Il trigger di M1 accetta l'operazione solo se
 * lo slot è libero e se nessun altro campo cambia (DD-016 regola 2): il vincolo vive nel
 * database, non qui.
 */
export function useCollegaGiocatore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { giocatoreId: string; utenteId: string }) => {
      const { error } = await supabaseNuoveTabelle
        .from("giocatori_squadra")
        .update({ auth_user_id: input.utenteId })
        .eq("id", input.giocatoreId)
        .is("auth_user_id", null);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      queryClient.setQueryData<GiocatoreSquadra[]>(SQUADRA_KEY, (prec) =>
        (prec ?? []).map((g) =>
          g.id === input.giocatoreId ? { ...g, authUserId: input.utenteId } : g,
        ),
      );
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseNuoveTabelle } from "@/integrations/supabase/client-nuove-tabelle";
import { giocatori } from "./crapp-data";

/**
 * Anagrafica operativa della squadra (`giocatori_squadra`, migration M1). È la source of
 * truth per il collegamento account ↔ giocatore; `crapp-data.ts` resta il fallback finché
 * la migrazione non è completa (DD-016 regola 1).
 */
export type GiocatoreSquadra = {
  id: string;
  nome: string;
  cognome: string;
  numero: number;
  ruolo: string;
  authUserId: string | null;
  attivo: boolean;
  email: string | null;
};

type RigaGiocatoreSquadra = {
  id: string;
  nome: string;
  cognome: string;
  numero: number;
  ruolo: string;
  auth_user_id: string | null;
  attivo: boolean;
  email: string | null;
};

export const SQUADRA_KEY = ["giocatori-squadra"] as const;

/** "Carlo Di Castelnuovo" -> nome "Carlo", cognome "Di Castelnuovo". */
export function dividiNome(completo: string): { nome: string; cognome: string } {
  const spazio = completo.indexOf(" ");
  if (spazio < 0) return { nome: completo, cognome: "" };
  return { nome: completo.slice(0, spazio), cognome: completo.slice(spazio + 1) };
}

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
  }));
}

export function nomeCompleto(g: GiocatoreSquadra): string {
  return `${g.nome} ${g.cognome}`.trim();
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

async function fetchSquadra(): Promise<GiocatoreSquadra[]> {
  const { data, error } = await supabaseNuoveTabelle
    .from("giocatori_squadra")
    .select("id, nome, cognome, numero, ruolo, auth_user_id, attivo, email")
    .order("id");
  if (error) throw error;
  const righe = (data ?? []) as RigaGiocatoreSquadra[];
  return righe.map((r) => ({
    id: r.id,
    nome: r.nome,
    cognome: r.cognome,
    numero: r.numero,
    ruolo: r.ruolo,
    authUserId: r.auth_user_id,
    attivo: r.attivo,
    email: r.email,
  }));
}

/** Anagrafica squadra: una lettura per sessione, cambia raramente. */
export function useGiocatoriSquadra() {
  const query = useQuery({ queryKey: SQUADRA_KEY, queryFn: fetchSquadra, staleTime: 30 * 60_000 });
  const righe = query.data?.length ? query.data : rosaFallback();
  return { ...query, righe, daDatabase: !!query.data?.length };
}

/** Dati squadra: li gestisce solo un amministratore (DD-017). L'email è quella usata per
 * il collegamento automatico al primo accesso (DD-018), non il dato personale del profilo. */
export type DatiSquadra = Pick<GiocatoreSquadra, "nome" | "cognome" | "numero" | "ruolo" | "email">;

/**
 * Controlli che rispecchiano i vincoli della tabella (`numero > 0`, campi obbligatori):
 * meglio dirlo qui che far tornare un errore Postgres all'utente.
 * Restituisce il messaggio da mostrare, oppure `null` se va bene.
 */
export function validaDatiSquadra(dati: DatiSquadra): string | null {
  if (!dati.nome.trim()) return "Il nome non può essere vuoto.";
  if (!dati.cognome.trim()) return "Il cognome non può essere vuoto.";
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
  return righe.some((g) => g.id !== giocatoreId && g.attivo && g.numero === numero);
}

/** Modifica dei dati squadra. Solo un admin passa le policy di M1. */
export function useSalvaDatiSquadra() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { giocatoreId: string; dati: DatiSquadra }) => {
      const dati = {
        nome: input.dati.nome.trim(),
        cognome: input.dati.cognome.trim(),
        numero: input.dati.numero,
        ruolo: input.dati.ruolo.trim(),
        email: input.dati.email?.trim() || null,
      };
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
 * Aggiunge un giocatore alla rosa (DD-017). Solo un admin passa le policy di M1.
 * L'id (`g<N>`) non è generato dal database: va calcolato con `prossimoIdGiocatore`
 * prima di chiamare questa mutazione.
 */
export function useAggiungiGiocatore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; dati: DatiSquadra }) => {
      const { error } = await supabaseNuoveTabelle.from("giocatori_squadra").insert({
        id: input.id,
        nome: input.dati.nome.trim(),
        cognome: input.dati.cognome.trim(),
        numero: input.dati.numero,
        ruolo: input.dati.ruolo.trim(),
        email: input.dati.email?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SQUADRA_KEY });
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

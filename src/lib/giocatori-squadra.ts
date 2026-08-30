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
};

type RigaGiocatoreSquadra = {
  id: string;
  nome: string;
  cognome: string;
  numero: number;
  ruolo: string;
  auth_user_id: string | null;
  attivo: boolean;
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

export function slotLiberi(righe: GiocatoreSquadra[]): GiocatoreSquadra[] {
  return righe.filter((g) => g.attivo && !g.authUserId);
}

async function fetchSquadra(): Promise<GiocatoreSquadra[]> {
  const { data, error } = await supabaseNuoveTabelle
    .from("giocatori_squadra")
    .select("id, nome, cognome, numero, ruolo, auth_user_id, attivo")
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
  }));
}

/** Anagrafica squadra: una lettura per sessione, cambia raramente. */
export function useGiocatoriSquadra() {
  const query = useQuery({ queryKey: SQUADRA_KEY, queryFn: fetchSquadra, staleTime: 30 * 60_000 });
  const righe = query.data?.length ? query.data : rosaFallback();
  return { ...query, righe, daDatabase: !!query.data?.length };
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

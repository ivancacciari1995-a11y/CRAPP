import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseNuoveTabelle } from "@/integrations/supabase/client-nuove-tabelle";
import { useGiocatoreId } from "./user-store";

/**
 * Centro notifiche in-app (M17): pallino sull'avatar del profilo, con il numero delle non
 * lette. Quattro sorgenti riempiono `notifiche_utente` (lato database, mai dal client): un
 * messaggio libero dell'admin, un promemoria automatico prima di un evento (24h e 3h), il
 * turno palloni e il sollecito presenze (questi due avviati a mano da un admin, in
 * parallelo alla push esistente). Qui si legge e si segna come letto, con
 * `supabaseNuoveTabelle` perché `types.ts` non include ancora questa tabella (vedi
 * client-nuove-tabelle.ts).
 */
export type TipoNotifica =
  | "admin"
  | "evento_promemoria_24h"
  | "evento_promemoria_3h"
  | "turno_palloni"
  | "sollecita_presenze";

export type NotificaUtente = {
  id: string;
  tipo: TipoNotifica;
  titolo: string;
  corpo: string;
  eventoId: string | null;
  letta: boolean;
  creataIl: string;
};

export type RigaNotifica = {
  id: string;
  tipo: TipoNotifica;
  titolo: string;
  corpo: string;
  evento_id: string | null;
  letta: boolean;
  creato_il: string;
};

const COLONNE = "id, tipo, titolo, corpo, evento_id, letta, creato_il";

/** Conversione riga database -> modello applicativo. */
export function daRiga(r: RigaNotifica): NotificaUtente {
  return {
    id: r.id,
    tipo: r.tipo,
    titolo: r.titolo,
    corpo: r.corpo,
    eventoId: r.evento_id,
    letta: r.letta,
    creataIl: r.creato_il,
  };
}

function chiaveNotifiche(giocatoreId: string | null) {
  return ["notifiche-utente", giocatoreId] as const;
}

/** Ultime notifiche del giocatore selezionato, più recenti per prime. */
export function useNotificheMie() {
  const giocatoreId = useGiocatoreId();
  const query = useQuery({
    queryKey: chiaveNotifiche(giocatoreId),
    queryFn: async (): Promise<NotificaUtente[]> => {
      const { data, error } = await supabaseNuoveTabelle
        .from("notifiche_utente")
        .select(COLONNE)
        .eq("giocatore_id", giocatoreId)
        .order("creato_il", { ascending: false })
        .limit(30);
      if (error) throw error;
      return ((data ?? []) as RigaNotifica[]).map(daRiga);
    },
    enabled: !!giocatoreId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const notifiche = query.data ?? [];
  return { ...query, notifiche, nonLette: notifiche.filter((n) => !n.letta).length };
}

/** Segna come lette tutte le notifiche non lette del giocatore selezionato. */
export function useSegnaLette() {
  const giocatoreId = useGiocatoreId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!giocatoreId) return;
      const { error } = await supabaseNuoveTabelle
        .from("notifiche_utente")
        .update({ letta: true })
        .eq("giocatore_id", giocatoreId)
        .eq("letta", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.setQueryData<NotificaUtente[]>(chiaveNotifiche(giocatoreId), (prec) =>
        (prec ?? []).map((n) => ({ ...n, letta: true })),
      );
    },
  });
}

/**
 * Elimina una notifica del giocatore selezionato (swipe o pulsante nel pannello). A
 * differenza di "segna come letta" qui la riga sparisce anche dal database, non solo
 * dalla vista: non c'è pulizia automatica delle notifiche vecchie, quindi eliminarla è
 * l'unico modo per un giocatore di toglierla di mezzo per sempre.
 */
export function useEliminaNotifica() {
  const giocatoreId = useGiocatoreId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseNuoveTabelle.from("notifiche_utente").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<NotificaUtente[]>(chiaveNotifiche(giocatoreId), (prec) =>
        (prec ?? []).filter((n) => n.id !== id),
      );
    },
  });
}

/** Testo del badge: il conteggio esatto fino a 9, poi "9+" per non farlo esplodere. */
export function contatoreBadge(nonLette: number): string {
  return nonLette > 9 ? "9+" : String(nonLette);
}

/**
 * Pallino sull'avatar del profilo: rosso con il numero delle non lette; se sono tutte lette
 * resta neutro con il totale, altrimenti le notifiche già lette non sarebbero più
 * raggiungibili per eliminarle. Senza notifiche non c'è (`null`).
 */
export function pallinoNotifiche(
  totale: number,
  nonLette: number,
): { testo: string; daLeggere: boolean } | null {
  if (totale === 0) return null;
  if (nonLette > 0) return { testo: contatoreBadge(nonLette), daLeggere: true };
  return { testo: contatoreBadge(totale), daLeggere: false };
}

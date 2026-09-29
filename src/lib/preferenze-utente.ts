import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseNuoveTabelle } from "@/integrations/supabase/client-nuove-tabelle";
import { useSessione } from "./auth";

/**
 * Preferenze del singolo account (M22), non dello slot giocatore: oggi solo l'interruttore
 * «Email» di Profilo → Opzioni (DD-036). Nessuna riga in `preferenze_utente` vuol dire
 * «mail attive»: la riga nasce solo quando il giocatore tocca l'interruttore. Lettura e
 * scrittura passano dalla RLS (ognuno vede e scrive solo la propria), senza route API.
 */
export type RigaPreferenze = { email_notifiche: boolean };

/** Assenza di riga = valori di default: le email sono attive. */
export function emailAttive(riga: RigaPreferenze | null | undefined): boolean {
  return riga?.email_notifiche ?? true;
}

const chiavePreferenze = (utenteId: string | null) => ["preferenze-utente", utenteId] as const;

/** Stato dell'interruttore «Email» dell'account e mutazione per cambiarlo. */
export function useEmailNotifiche() {
  const { utenteId } = useSessione();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: chiavePreferenze(utenteId),
    queryFn: async (): Promise<RigaPreferenze | null> => {
      const { data, error } = await supabaseNuoveTabelle
        .from("preferenze_utente")
        .select("email_notifiche")
        .eq("auth_user_id", utenteId)
        .maybeSingle();
      if (error) throw error;
      return (data as RigaPreferenze | null) ?? null;
    },
    enabled: !!utenteId,
    staleTime: 5 * 60_000,
  });

  const imposta = useMutation({
    mutationFn: async (attive: boolean) => {
      const { error } = await supabaseNuoveTabelle.from("preferenze_utente").upsert(
        {
          auth_user_id: utenteId,
          email_notifiche: attive,
          aggiornata_il: new Date().toISOString(),
        },
        { onConflict: "auth_user_id" },
      );
      if (error) throw error;
      return attive;
    },
    onSuccess: (attive) => {
      const riga: RigaPreferenze = { email_notifiche: attive };
      qc.setQueryData(chiavePreferenze(utenteId), riga);
    },
  });

  return { attive: emailAttive(query.data), pronta: !query.isPending, imposta };
}

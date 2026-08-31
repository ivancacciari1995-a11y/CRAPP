import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessione } from "./auth";

export const RUOLI_KEY = ["ruolo-admin"] as const;

/**
 * Permessi di amministrazione: unica fonte è `user_roles` nel database (DD-011).
 * Nessuna lista di nomi, altrimenti basterebbe scegliere il nome giusto per amministrare.
 */

/** `null` = nessuna sessione, quindi il database non ha una risposta da dare. */
async function fetchRuoloAdmin(utenteId: string | null): Promise<boolean | null> {
  if (!utenteId) return null;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", utenteId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export function useIsAdmin(): boolean {
  const { utenteId } = useSessione();
  // Il ruolo cambia solo quando un admin lo assegna: una lettura per sessione basta.
  const query = useQuery({
    queryKey: [...RUOLI_KEY, utenteId],
    queryFn: () => fetchRuoloAdmin(utenteId),
    staleTime: 30 * 60_000,
  });
  return query.data === true;
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin as nomeInListaAdmin } from "./crapp-data";
import { useSessione } from "./auth";
import { useGiocatoreBase } from "./user-store";

export const RUOLI_KEY = ["ruolo-admin"] as const;

/**
 * Permessi di amministrazione. La fonte è `user_roles` nel database (DD-011): la lista di
 * nomi in `crapp-data.ts` resta solo come ponte per chi non ha ancora collegato l'account,
 * e sparisce quando `VITE_AUTH_OBBLIGATORIA` viene acceso in produzione.
 *
 * ponytail: doppia fonte temporanea, si riduce a `ruoloDb` appena l'auth è obbligatoria.
 */
export function risolviAdmin(ruoloDb: boolean | null, giocatoreId: string | null): boolean {
  if (ruoloDb !== null) return ruoloDb;
  return giocatoreId ? nomeInListaAdmin(giocatoreId) : false;
}

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
  const io = useGiocatoreBase();
  // Il ruolo cambia solo quando un admin lo assegna: una lettura per sessione basta.
  const query = useQuery({
    queryKey: [...RUOLI_KEY, utenteId],
    queryFn: () => fetchRuoloAdmin(utenteId),
    staleTime: 30 * 60_000,
  });
  return risolviAdmin(query.data ?? null, io?.id ?? null);
}

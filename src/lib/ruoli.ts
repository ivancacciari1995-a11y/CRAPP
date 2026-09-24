import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessione } from "./auth";

export const RUOLI_KEY = ["ruoli-utente"] as const;

export type Ruolo = "admin" | "allenatore";

/**
 * Permessi: unica fonte è `user_roles` nel database (DD-011). Nessuna lista di nomi,
 * altrimenti basterebbe scegliere il nome giusto per amministrare. Il ruolo `allenatore`
 * lo scrive un trigger quando si collega uno slot di tipo allenatore (M21, DD-034).
 */

/** `null` = nessuna sessione, quindi il database non ha una risposta da dare. */
async function fetchRuoli(utenteId: string | null): Promise<Ruolo[] | null> {
  if (!utenteId) return null;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", utenteId)
    .in("role", ["admin", "allenatore"]);
  if (error) throw error;
  return (data ?? []).map((r) => r.role as Ruolo);
}

function useRuoli(): Ruolo[] {
  const { utenteId } = useSessione();
  // Il ruolo cambia solo quando un admin lo assegna: una lettura per sessione basta.
  const query = useQuery({
    queryKey: [...RUOLI_KEY, utenteId],
    queryFn: () => fetchRuoli(utenteId),
    staleTime: 30 * 60_000,
  });
  return query.data ?? [];
}

export function useIsAdmin(): boolean {
  return useRuoli().includes("admin");
}

export function useIsAllenatore(): boolean {
  return useRuoli().includes("allenatore");
}

/** Chi crea e modifica gli eventi e sollecita le presenze: admin o allenatore (DD-034). */
export function usePuoGestireEventi(): boolean {
  const ruoli = useRuoli();
  return ruoli.includes("admin") || ruoli.includes("allenatore");
}

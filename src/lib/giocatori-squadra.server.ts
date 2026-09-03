import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COLONNE_SQUADRA,
  daRigaSquadra,
  type GiocatoreSquadra,
  type RigaGiocatoreSquadra,
} from "./giocatori-squadra";

/** Lettura squadra lato server (route API): stessa conversione del client. */
export async function leggiGiocatoriSquadra(): Promise<GiocatoreSquadra[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // `types.ts` non include ancora `giocatori_squadra` con le colonne di M8 (vedi client-nuove-tabelle.ts).
  const client = supabaseAdmin as unknown as SupabaseClient;
  const { data } = await client
    .from("giocatori_squadra")
    .select(COLONNE_SQUADRA)
    .order("cognome")
    .order("nome");
  return ((data ?? []) as RigaGiocatoreSquadra[]).map(daRigaSquadra);
}

import { daRiga, type Evento, type RigaEvento } from "./eventi";

const COLONNE =
  "id, tipo, titolo, luogo, data, ora, note, convocati, campionato, casa, pagelle_chiuse";

/** Lettura eventi lato server (route API): stessa conversione del client. */
export async function leggiEventi(): Promise<Evento[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("eventi_app").select(COLONNE).order("data");
  return ((data ?? []) as RigaEvento[]).map(daRiga);
}

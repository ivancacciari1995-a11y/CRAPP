import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./client";

/**
 * `types.ts` è generato dallo schema e non include ancora le tabelle introdotte dalle
 * migration M1 (`giocatori_squadra`) e M2 (`profili_giocatore`). Finché non viene
 * rigenerato si passa da qui: i tipi delle righe sono dichiarati nei moduli di `src/lib/`,
 * che restano l'unico punto di accesso al database (DD-013).
 *
 * Da eliminare quando `types.ts` sarà rigenerato: i moduli torneranno a usare `supabase`.
 */
export const supabaseNuoveTabelle = supabase as unknown as SupabaseClient;

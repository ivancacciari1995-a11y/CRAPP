/**
 * Controllo di accesso per le route in `src/routes/api/public/` che inviano notifiche
 * a tutta la squadra (DD-024).
 *
 * Quelle route usano la service role e saltano la RLS: senza un controllo qui, chiunque
 * conosca l'URL può far suonare i telefoni di tutti. L'id di un evento non è un segreto —
 * è un timestamp in base 36 e compare negli URL che la squadra si scambia — quindi non
 * può fare da credenziale.
 *
 * Le route che mandano notifiche partono da un pulsante riservato agli amministratori, e il
 * sollecito presenze anche agli allenatori (DD-034): `richiediAdmin` e `richiediGestoreEventi`
 * verificano il token della sessione Supabase e poi il ruolo in `user_roles`. Torna `null` quando la richiesta può
 * proseguire, altrimenti la `Response` di rifiuto già pronta.
 */

/** Il token della sessione Supabase, se la richiesta ne porta uno ben formato. */
function tokenDaRichiesta(request: Request): string | null {
  const intestazione = request.headers.get("authorization");
  if (!intestazione?.startsWith("Bearer ")) return null;
  const token = intestazione.slice("Bearer ".length).trim();
  // Un JWT ha tre segmenti non vuoti: scartarlo qui evita una chiamata di rete per ogni rumore.
  const segmenti = token.split(".");
  return segmenti.length === 3 && segmenti.every(Boolean) ? token : null;
}

/**
 * Lascia passare solo un utente autenticato con almeno uno dei `ruoli`. `401` se manca o non
 * vale il token, `403` se il token è buono ma il ruolo no.
 */
async function richiediRuolo(
  request: Request,
  ruoli: Array<"admin" | "allenatore">,
  rifiuto: string,
): Promise<Response | null> {
  const token = tokenDaRichiesta(request);
  if (!token) return new Response("Autenticazione richiesta", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: utente, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !utente?.user) return new Response("Sessione non valida", { status: 401 });

  // Stessa fonte di `src/lib/ruoli.ts`: i permessi stanno solo in `user_roles` (DD-011).
  const { data: righe } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", utente.user.id)
    .in("role", ruoli);

  if (!righe?.length) return new Response(rifiuto, { status: 403 });
  return null;
}

/** Solo un amministratore: promemoria palloni, messaggi, sondaggio, notifiche attive. */
export function richiediAdmin(request: Request): Promise<Response | null> {
  return richiediRuolo(request, ["admin"], "Riservato agli amministratori");
}

/** Admin o allenatore: chi gestisce gli eventi può anche sollecitare le presenze (DD-034). */
export function richiediGestoreEventi(request: Request): Promise<Response | null> {
  return richiediRuolo(request, ["admin", "allenatore"], "Riservato a admin e allenatori");
}

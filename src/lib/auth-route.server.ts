/**
 * Controllo di accesso per le route in `src/routes/api/public/` che inviano notifiche
 * a tutta la squadra (DD-024).
 *
 * Quelle route usano la service role e saltano la RLS: senza un controllo qui, chiunque
 * conosca l'URL può far suonare i telefoni di tutti. L'id di un evento non è un segreto —
 * è un timestamp in base 36 e compare negli URL che la squadra si scambia — quindi non
 * può fare da credenziale.
 *
 * Due tipi di chiamante, due controlli:
 * - dall'app, per un'azione da amministratore -> `richiediAdmin`, che verifica il token
 *   della sessione Supabase e poi il ruolo in `user_roles`;
 * - da una macchina (cron), dove nessuna sessione esiste -> `richiediSegreto`.
 *
 * Entrambe tornano `null` quando la richiesta può proseguire, altrimenti la `Response` di
 * rifiuto già pronta.
 */

/** Il token della sessione Supabase, se la richiesta ne porta uno ben formato. */
function tokenDaRichiesta(request: Request): string | null {
  const intestazione = request.headers.get("authorization");
  if (!intestazione?.startsWith("Bearer ")) return null;
  const token = intestazione.slice("Bearer ".length).trim();
  // Un JWT ha tre segmenti: scartarlo qui evita una chiamata di rete per ogni rumore.
  return token && token.split(".").length === 3 ? token : null;
}

/**
 * Lascia passare solo un amministratore autenticato. `401` se manca o non vale il token,
 * `403` se il token è buono ma l'utente non è admin.
 */
export async function richiediAdmin(request: Request): Promise<Response | null> {
  const token = tokenDaRichiesta(request);
  if (!token) return new Response("Autenticazione richiesta", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: utente, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !utente?.user) return new Response("Sessione non valida", { status: 401 });

  // Stessa fonte di `src/lib/ruoli.ts`: i permessi stanno solo in `user_roles` (DD-011).
  const { data: ruolo } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", utente.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!ruolo) return new Response("Riservato agli amministratori", { status: 403 });
  return null;
}

/**
 * Lascia passare solo chi conosce `CRON_SEGRETO`, per le chiamate senza sessione.
 *
 * Se la variabile non è configurata la route resta chiusa: una porta che si apre da sola
 * quando manca una configurazione è peggio di una porta che non funziona, perché nessuno
 * se ne accorge.
 */
export function richiediSegreto(request: Request): Response | null {
  const atteso = process.env["CRON_SEGRETO"];
  if (!atteso) {
    console.error("[auth] CRON_SEGRETO non configurato: la route resta chiusa");
    return new Response("Route non configurata", { status: 503 });
  }
  const fornito = request.headers.get("x-cron-segreto");
  if (fornito !== atteso) return new Response("Segreto non valido", { status: 401 });
  return null;
}

import { createFileRoute } from "@tanstack/react-router";

/**
 * Chiamata dal Vercel Cron Job (vedi vercel.json) per tenere attivo il progetto Supabase
 * free tier, che va in pausa dopo 7 giorni senza richieste API. Una lettura minima basta:
 * nessun dato sensibile, nessun effetto collaterale, quindi nessuna autenticazione richiesta.
 */
export const Route = createFileRoute("/api/public/keepalive")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("giocatori_squadra")
          .select("id", { count: "exact", head: true })
          .limit(1);
        if (error) {
          console.error("keepalive", error);
          return new Response("Errore", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});

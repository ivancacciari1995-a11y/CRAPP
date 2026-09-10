import { createFileRoute } from "@tanstack/react-router";
import { richiediAdmin } from "@/lib/auth-route.server";
import { idsConNotificheAttive } from "@/lib/notifiche-attive.server";

export const Route = createFileRoute("/api/public/notifiche-attive")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const negato = await richiediAdmin(request);
        if (negato) return negato;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("push_subscriptions")
          .select("giocatore_id");
        if (error) {
          console.error("notifiche-attive", error);
          return new Response("Errore lettura", { status: 500 });
        }

        return Response.json({ giocatoreIds: idsConNotificheAttive(data ?? []) });
      },
    },
  },
});

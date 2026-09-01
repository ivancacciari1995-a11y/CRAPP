import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schemaIscrizione = z.object({
  endpoint: z.string().url().max(1000),
  giocatoreId: z.string().min(1).max(50),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
});

const schemaCancellazione = z.object({ endpoint: z.string().url().max(1000) });

export const Route = createFileRoute("/api/public/push-subscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schemaIscrizione.safeParse(await request.json());
        if (!parsed.success) return new Response("Dati non validi", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
          {
            endpoint: parsed.data.endpoint,
            giocatore_id: parsed.data.giocatoreId,
            p256dh: parsed.data.p256dh,
            auth: parsed.data.auth,
          },
          { onConflict: "endpoint" },
        );
        if (error) {
          console.error("push-subscribe", error);
          return new Response("Errore salvataggio", { status: 500 });
        }
        return Response.json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const parsed = schemaCancellazione.safeParse(await request.json());
        if (!parsed.success) return new Response("Dati non validi", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", parsed.data.endpoint);
        return Response.json({ ok: true });
      },
    },
  },
});

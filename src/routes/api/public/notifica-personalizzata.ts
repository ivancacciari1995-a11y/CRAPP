import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { richiediAdmin } from "@/lib/auth-route.server";
import { inviaPush } from "@/lib/webpush.server";

const schema = z.object({
  messaggio: z.string().min(1).max(300),
  giocatoreId: z.string().min(1).max(50).optional(),
});

export const Route = createFileRoute("/api/public/notifica-personalizzata")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const negato = await richiediAdmin(request);
        if (negato) return negato;

        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) return new Response("Dati non validi", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let query = supabaseAdmin.from("push_subscriptions").select("endpoint, p256dh, auth");
        if (parsed.data.giocatoreId) {
          query = query.eq("giocatore_id", parsed.data.giocatoreId);
        }
        const { data: iscrizioni } = await query;

        const titolo = "Messaggio dallo staff";
        const testo = parsed.data.messaggio.trim();

        let inviate = 0;
        for (const iscrizione of iscrizioni ?? []) {
          try {
            const { stato } = await inviaPush(iscrizione, titolo, testo);
            if (stato === 404 || stato === 410) {
              await supabaseAdmin
                .from("push_subscriptions")
                .delete()
                .eq("endpoint", iscrizione.endpoint);
            } else if (stato >= 200 && stato < 300) {
              inviate += 1;
            }
          } catch (error) {
            console.error("notifica-personalizzata", error);
          }
        }

        return Response.json({ inviate, destinatari: iscrizioni?.length ?? 0 });
      },
    },
  },
});

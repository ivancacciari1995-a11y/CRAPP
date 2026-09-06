import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { richiediAdmin } from "@/lib/auth-route.server";
import { leggiEventi } from "@/lib/eventi.server";
import { inviaPush } from "@/lib/webpush.server";

const schema = z.object({ eventoId: z.string().min(1).max(50) });

/** Avviso "sondaggio pre-partita aperto": lo fa partire un admin dalla pagina partita. */
export const Route = createFileRoute("/api/public/apri-sondaggio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const negato = await richiediAdmin(request);
        if (negato) return negato;

        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) return new Response("Dati non validi", { status: 400 });

        const eventi = await leggiEventi();
        const partita = eventi.find((e) => e.id === parsed.data.eventoId);
        if (!partita) return new Response("Evento non trovato", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: iscrizioni } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint");

        const titolo = "💩 Sondaggio pre-partita aperto";
        const testo = `${partita.titolo} · ore ${partita.ora}. Quante cacche hai fatto? Rispondi prima del fischio d'inizio.`;

        let inviate = 0;
        for (const iscrizione of iscrizioni ?? []) {
          try {
            await supabaseAdmin
              .from("promemoria_push")
              .insert({ endpoint: iscrizione.endpoint, titolo, testo });
            const stato = await inviaPush(iscrizione.endpoint);
            if (stato === 404 || stato === 410) {
              await supabaseAdmin
                .from("push_subscriptions")
                .delete()
                .eq("endpoint", iscrizione.endpoint);
            } else if (stato >= 200 && stato < 300) {
              inviate += 1;
            }
          } catch (error) {
            console.error("apri-sondaggio", error);
          }
        }

        return Response.json({ inviate, destinatari: (iscrizioni ?? []).length });
      },
    },
  },
});

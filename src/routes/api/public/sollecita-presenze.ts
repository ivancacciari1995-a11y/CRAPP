import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { richiediAdmin } from "@/lib/auth-route.server";
import { formatData } from "@/lib/crapp-data";
import { leggiEventi } from "@/lib/eventi.server";
import { leggiGiocatoriSquadra } from "@/lib/giocatori-squadra.server";
import { inviaPush } from "@/lib/webpush.server";

const schema = z.object({
  eventoId: z.string().min(1).max(50),
  da: z.string().min(1).max(60).optional(),
});

export const Route = createFileRoute("/api/public/sollecita-presenze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const negato = await richiediAdmin(request);
        if (negato) return negato;

        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) return new Response("Dati non validi", { status: 400 });

        const eventi = await leggiEventi();
        const evento = eventi.find((e) => e.id === parsed.data.eventoId);
        if (!evento) return new Response("Evento non trovato", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: righe } = await supabaseAdmin
          .from("risposte_presenze")
          .select("giocatore_id, stato")
          .eq("evento_id", evento.id);

        const squadra = await leggiGiocatoriSquadra();
        const stati = new Map((righe ?? []).map((r) => [r.giocatore_id, r.stato]));
        const destinatari = squadra
          .filter((g) => g.attivo)
          .filter((g) => {
            const stato = stati.get(g.id);
            return stato === undefined || stato === "forse";
          })
          .map((g) => g.id);

        if (destinatari.length === 0) return Response.json({ inviate: 0, destinatari: 0 });

        const { data: iscrizioni } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, giocatore_id")
          .in("giocatore_id", destinatari);

        const titolo = "Manca la tua risposta";
        const testo = `${evento.titolo} · ${formatData(evento.data)} ore ${evento.ora}. ${
          parsed.data.da ? `${parsed.data.da} chiede` : "Serve"
        } una conferma: presente, assente o in ritardo?`;

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
            console.error("sollecita-presenze", error);
          }
        }

        return Response.json({ inviate, destinatari: destinatari.length });
      },
    },
  },
});

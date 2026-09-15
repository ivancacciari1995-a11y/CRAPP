import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { richiediAdmin } from "@/lib/auth-route.server";
import { formatData } from "@/lib/crapp-data";
import { leggiEventi } from "@/lib/eventi.server";
import { leggiGiocatoriSquadra } from "@/lib/giocatori-squadra.server";
import { destinatariSollecito } from "@/lib/presenze";
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
        const destinatari = destinatariSollecito(squadra, righe ?? []);

        if (destinatari.length === 0) return Response.json({ inviate: 0, destinatari: 0 });

        const { data: iscrizioni } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .in("giocatore_id", destinatari);

        const titolo = "Manca la tua risposta";
        const testo = `${evento.titolo} · ${formatData(evento.data)} ore ${evento.ora}. ${
          parsed.data.da ? `${parsed.data.da} chiede` : "Serve"
        } una conferma: presente, assente o in ritardo?`;

        // Storico in-app (M17): un upsert perché ripremere il pulsante deve riportare la
        // notifica a non letta, non fallire per il vincolo UNIQUE. `types.ts` non include
        // ancora `notifiche_utente`, stesso aggiramento di `giocatori-squadra.server.ts`.
        const client = supabaseAdmin as unknown as SupabaseClient;
        await client.from("notifiche_utente").upsert(
          destinatari.map((giocatoreId) => ({
            giocatore_id: giocatoreId,
            tipo: "sollecita_presenze",
            titolo,
            corpo: testo,
            evento_id: evento.id,
            letta: false,
            creato_il: new Date().toISOString(),
          })),
          { onConflict: "giocatore_id,evento_id,tipo" },
        );

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
            console.error("sollecita-presenze", error);
          }
        }

        return Response.json({ inviate, destinatari: destinatari.length });
      },
    },
  },
});

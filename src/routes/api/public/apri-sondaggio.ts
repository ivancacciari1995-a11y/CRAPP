import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { richiediAdmin } from "@/lib/auth-route.server";
import { avvisoSondaggio, destinatariSondaggio } from "@/lib/cacche";
import { leggiEventi } from "@/lib/eventi.server";
import { inviaPush } from "@/lib/webpush.server";
import { isAllenatore } from "@/lib/giocatori-squadra";
import { leggiGiocatoriSquadra } from "@/lib/giocatori-squadra.server";

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
        const { data: tutte } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth, giocatore_id");
        const squadra = await leggiGiocatoriSquadra();
        // Il sondaggio cacche non riguarda l'allenatore, che non le vede (DD-034).
        const allenatori = new Set(squadra.filter(isAllenatore).map((g) => g.id));
        const iscrizioni = (tutte ?? []).filter((i) => !allenatori.has(i.giocatore_id));

        const { titolo, testo } = avvisoSondaggio(partita);

        // Storico in-app ed email (DD-038): indipendente dai dispositivi iscritti alla push. Un
        // upsert perché ripremere il pulsante per la stessa partita deve riportare la notifica a
        // non letta, non fallire per il vincolo UNIQUE; la mail riparte dal trigger di M22.
        // `types.ts` non include ancora `notifiche_utente`, stesso aggiramento delle altre route.
        const client = supabaseAdmin as unknown as SupabaseClient;
        await client.from("notifiche_utente").upsert(
          destinatariSondaggio(squadra).map((giocatoreId) => ({
            giocatore_id: giocatoreId,
            tipo: "sondaggio_cacche",
            titolo,
            corpo: testo,
            evento_id: partita.id,
            letta: false,
            creato_il: new Date().toISOString(),
          })),
          { onConflict: "giocatore_id,evento_id,tipo" },
        );

        let inviate = 0;
        for (const iscrizione of iscrizioni) {
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
            console.error("apri-sondaggio", error);
          }
        }

        return Response.json({ inviate, destinatari: iscrizioni.length });
      },
    },
  },
});

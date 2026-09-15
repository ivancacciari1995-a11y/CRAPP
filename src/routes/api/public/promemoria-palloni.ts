import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { richiediAdmin } from "@/lib/auth-route.server";
import { nomeCompleto } from "@/lib/giocatori-squadra";
import { leggiGiocatoriSquadra } from "@/lib/giocatori-squadra.server";
import { avvisiPalloniEvento, completaTurni } from "@/lib/palloni-core";
import { inviaPush } from "@/lib/webpush.server";
import { leggiEventi } from "@/lib/eventi.server";

const schema = z.object({ eventoId: z.string().min(1).max(50) });

/**
 * Promemoria del turno palloni per un evento: lo fa partire un admin dalla pagina
 * dell'evento (DD-025). Il testo viaggia cifrato dentro la push.
 */
export const Route = createFileRoute("/api/public/promemoria-palloni")({
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
          .from("turni_palloni")
          .select("evento_id, giocatore_id");
        const salvati: Record<string, string> = {};
        for (const riga of righe ?? []) salvati[riga.evento_id] = riga.giocatore_id;

        const squadra = await leggiGiocatoriSquadra();
        const rosa = squadra
          .filter((g) => g.attivo)
          .map((g) => ({ id: g.id, nome: nomeCompleto(g) }));
        const turni = completaTurni(salvati, eventi, rosa);

        const avvisi = avvisiPalloniEvento(turni, eventi, evento.id);
        if (avvisi.length === 0) return Response.json({ inviate: 0, destinatari: 0 });

        // Storico in-app (M17): un upsert perché ripremere il pulsante deve riportare la
        // notifica a non letta con il testo aggiornato, non fallire per il vincolo UNIQUE.
        // `types.ts` non include ancora `notifiche_utente`, stesso aggiramento di
        // `giocatori-squadra.server.ts`.
        const client = supabaseAdmin as unknown as SupabaseClient;
        await client.from("notifiche_utente").upsert(
          avvisi.map((a) => ({
            giocatore_id: a.giocatoreId,
            tipo: "turno_palloni",
            titolo: a.titolo,
            corpo: a.testo,
            evento_id: evento.id,
            letta: false,
            creato_il: new Date().toISOString(),
          })),
          { onConflict: "giocatore_id,evento_id,tipo" },
        );

        const { data: iscrizioni } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, giocatore_id, p256dh, auth")
          .in(
            "giocatore_id",
            avvisi.map((a) => a.giocatoreId),
          );

        let inviate = 0;
        for (const iscrizione of iscrizioni ?? []) {
          const avviso = avvisi.find((a) => a.giocatoreId === iscrizione.giocatore_id);
          if (!avviso) continue;
          try {
            const { stato } = await inviaPush(iscrizione, avviso.titolo, avviso.testo);
            if (stato === 404 || stato === 410) {
              await supabaseAdmin
                .from("push_subscriptions")
                .delete()
                .eq("endpoint", iscrizione.endpoint);
            } else if (stato >= 200 && stato < 300) {
              inviate += 1;
            }
          } catch (error) {
            console.error("promemoria-palloni", error);
          }
        }

        return Response.json({ inviate, destinatari: (iscrizioni ?? []).length });
      },
    },
  },
});

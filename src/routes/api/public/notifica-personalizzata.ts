import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
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
        // `types.ts` non include ancora `notifiche_utente` (M17): stesso aggiramento di
        // `giocatori-squadra.server.ts` finché non viene rigenerato.
        const client = supabaseAdmin as unknown as SupabaseClient;

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

        // Storico in-app (M17): indipendente dall'esito della push, e non limitato a chi ha
        // un dispositivo iscritto. Senza `giocatoreId` va a tutta la rosa attiva.
        let destinatariNotifica: string[];
        if (parsed.data.giocatoreId) {
          destinatariNotifica = [parsed.data.giocatoreId];
        } else {
          const { data: rosa } = await client
            .from("giocatori_squadra")
            .select("id")
            .eq("attivo", true);
          destinatariNotifica = ((rosa ?? []) as Array<{ id: string }>).map((r) => r.id);
        }
        if (destinatariNotifica.length > 0) {
          await client.from("notifiche_utente").insert(
            destinatariNotifica.map((giocatoreId) => ({
              giocatore_id: giocatoreId,
              tipo: "admin",
              titolo,
              corpo: testo,
            })),
          );
        }

        return Response.json({ inviate, destinatari: iscrizioni?.length ?? 0 });
      },
    },
  },
});

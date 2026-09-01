import { createFileRoute } from "@tanstack/react-router";
import { completaTurni, destinatariPromemoriaPalloni, oggiISO } from "@/lib/palloni-core";
import { inviaPush } from "@/lib/webpush.server";
import { leggiEventi } from "@/lib/eventi.server";

export const Route = createFileRoute("/api/public/promemoria-palloni")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: righe } = await supabaseAdmin
          .from("turni_palloni")
          .select("evento_id, giocatore_id");
        const salvati: Record<string, string> = {};
        for (const riga of righe ?? []) salvati[riga.evento_id] = riga.giocatore_id;
        const eventi = await leggiEventi();
        const turni = completaTurni(salvati, eventi);

        const oggi = oggiISO();
        const destinatari = destinatariPromemoriaPalloni(turni, eventi, oggi);

        if (destinatari.length === 0) return Response.json({ inviate: 0 });

        const { data: iscrizioni } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, giocatore_id")
          .in("giocatore_id", destinatari);

        let inviate = 0;
        for (const iscrizione of iscrizioni ?? []) {
          try {
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
            console.error("promemoria-palloni", error);
          }
        }

        return Response.json({ inviate });
      },
    },
  },
});

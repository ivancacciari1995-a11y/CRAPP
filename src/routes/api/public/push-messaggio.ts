import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { nomeCompleto } from "@/lib/giocatori-squadra";
import { leggiGiocatoriSquadra } from "@/lib/giocatori-squadra.server";
import { completaTurni, messaggioPalloniOggi, oggiISO } from "@/lib/palloni-core";
import { leggiEventi } from "@/lib/eventi.server";
import { promemoriaAncoraValido } from "@/lib/webpush.server";

const schema = z.object({ endpoint: z.string().url().max(1000) });

export const Route = createFileRoute("/api/public/push-messaggio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) return new Response("Dati non validi", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Messaggio in coda (es. sollecito presenze): ha la precedenza e viene consumato.
        const { data: promemoria } = await supabaseAdmin
          .from("promemoria_push")
          .select("id, titolo, testo, creato_il")
          .eq("endpoint", parsed.data.endpoint)
          .order("creato_il", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (promemoria) {
          // La coda si svuota comunque, anche quando il messaggio è vecchio: altrimenti
          // resterebbe lì a dirottare la prossima notifica di qualunque tipo.
          await supabaseAdmin.from("promemoria_push").delete().eq("endpoint", parsed.data.endpoint);
          if (promemoriaAncoraValido(promemoria.creato_il)) {
            return Response.json({ title: promemoria.titolo, body: promemoria.testo });
          }
        }

        const { data: iscrizione } = await supabaseAdmin
          .from("push_subscriptions")
          .select("giocatore_id")
          .eq("endpoint", parsed.data.endpoint)
          .maybeSingle();

        if (!iscrizione)
          return Response.json({ title: "CrAPP", body: "Controlla il turno palloni." });

        const { data: righe } = await supabaseAdmin
          .from("turni_palloni")
          .select("evento_id, giocatore_id");
        const salvati: Record<string, string> = {};
        for (const riga of righe ?? []) salvati[riga.evento_id] = riga.giocatore_id;
        const eventi = await leggiEventi();
        const squadra = await leggiGiocatoriSquadra();
        const rosa = squadra
          .filter((g) => g.attivo)
          .map((g) => ({ id: g.id, nome: nomeCompleto(g) }));
        const turni = completaTurni(salvati, eventi, rosa);

        const oggi = oggiISO();
        const mioId = iscrizione.giocatore_id;
        const giocatore = squadra.find((g) => g.id === mioId);
        const nome = giocatore ? nomeCompleto(giocatore) : "";

        return Response.json(messaggioPalloniOggi(turni, eventi, oggi, mioId, nome));
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { giocatori } from "@/lib/crapp-data";
import { completaTurni, messaggioPalloniOggi, oggiISO } from "@/lib/palloni-core";
import { leggiEventi } from "@/lib/eventi.server";

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
          .select("id, titolo, testo")
          .eq("endpoint", parsed.data.endpoint)
          .order("creato_il", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (promemoria) {
          await supabaseAdmin.from("promemoria_push").delete().eq("endpoint", parsed.data.endpoint);
          return Response.json({ title: promemoria.titolo, body: promemoria.testo });
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
        const turni = completaTurni(salvati, eventi);

        const oggi = oggiISO();
        const mioId = iscrizione.giocatore_id;
        const nome = giocatori.find((g) => g.id === mioId)?.nome ?? "";

        return Response.json(messaggioPalloniOggi(turni, eventi, oggi, mioId, nome));
      },
    },
  },
});

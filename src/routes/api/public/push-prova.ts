import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { inviaPush } from "@/lib/webpush.server";

const schema = z.object({ endpoint: z.string().url().max(1000) });

/**
 * Manda una push di prova al dispositivo che la chiede, e racconta com'è andata.
 *
 * Serve a rendere osservabile un guasto che finora si vedeva solo come "non arriva":
 * senza questa route ogni prova richiede un admin, un evento nello stato giusto e una
 * seconda persona, e la risposta del servizio push viene buttata via. Qui invece si vede
 * lo stato HTTP, il corpo della risposta e se l'endpoint è davvero quello registrato in
 * `push_subscriptions` — cioè se il server sta parlando con questo telefono o con una
 * vecchia iscrizione morta.
 *
 * Nessun controllo di accesso, come per `push-config` e `push-subscribe`: manda solo
 * all'endpoint che il chiamante fornisce, quindi al massimo si sveglia da solo. È un URL
 * segreto per dispositivo, e chi lo conosce lo ha già.
 */
export const Route = createFileRoute("/api/public/push-prova")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) return new Response("Dati non validi", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: iscrizione } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("endpoint", parsed.data.endpoint)
          .maybeSingle();

        if (!iscrizione) {
          // Il dispositivo ha una sottoscrizione che il database non conosce: la push non
          // partirebbe mai da sola, perché i mittenti leggono solo da qui.
          return Response.json({
            nelDatabase: false,
            stato: 0,
            corpo: "Questo dispositivo non risulta iscritto: riattiva le notifiche.",
          });
        }

        const { stato, corpo } = await inviaPush(
          iscrizione,
          "🔔 Notifica di prova",
          `Inviata alle ${new Date().toLocaleTimeString("it-IT")}. Se la leggi ad app chiusa, il canale funziona.`,
        );
        return Response.json({ nelDatabase: true, stato, corpo });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { inviaPush } from "@/lib/webpush.server";

/** Quanto aspettare prima di mandare davvero, per dare il tempo di chiudere l'app. */
const RITARDO_PREDEFINITO_MS = 10_000;

const schema = z.object({
  endpoint: z.string().url().max(1000),
  ritardoMs: z.number().int().min(0).max(25_000).optional(),
});

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
 * L'invio è ritardato di qualche secondo: premendo il pulsante l'app è per forza aperta,
 * quindi senza attesa la notifica arriverebbe sempre in primo piano — cioè nell'unico caso
 * che non serve provare.
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

        // ponytail: la funzione resta aperta per il ritardo, semplice ma limitato dal
        // tetto di durata dell'hosting. Se servisse aspettare di più, ci vuole una coda.
        await new Promise((r) => setTimeout(r, parsed.data.ritardoMs ?? RITARDO_PREDEFINITO_MS));

        const { stato, corpo } = await inviaPush(
          iscrizione,
          "🔔 Notifica di prova",
          // Il fuso va detto: il server gira in UTC, quindi senza `timeZone` l'orario
          // arriverebbe indietro di un'ora o due e sembrerebbe un orologio sballato.
          `Inviata alle ${new Date().toLocaleTimeString("it-IT", {
            timeZone: "Europe/Rome",
            hour: "2-digit",
            minute: "2-digit",
          })}. Se la leggi ad app chiusa, il canale funziona.`,
        );
        return Response.json({ nelDatabase: true, stato, corpo });
      },
    },
  },
});

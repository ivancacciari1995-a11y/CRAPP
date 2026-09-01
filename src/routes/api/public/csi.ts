import { createFileRoute } from "@tanstack/react-router";
import {
  CSI_GIRONE,
  parseClassifica,
  partiteDaEventi,
  urlClassifica,
  urlPartite,
  type DatiCsi,
} from "@/lib/csi-core";

const SCADENZA_MS = 6 * 60 * 60 * 1000;

// ponytail: cache in memoria del processo, si perde ai cold start e non è
// condivisa tra istanze. Basta per una squadra; se il portale CSI diventa
// lento o le richieste crescono, spostare i dati in una tabella Supabase
// riempita da un job cron (stesso pattern di promemoria-palloni).
let cache: DatiCsi | undefined;
let scadenza = 0;

async function scarica(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "CrAPP/1.0 (+https://crapvolley.it)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`CSI ${res.status} su ${url}`);
  return res.text();
}

async function leggiCsi(): Promise<DatiCsi> {
  const [html, json] = await Promise.all([scarica(urlClassifica()), scarica(urlPartite())]);
  const classifica = parseClassifica(html);
  const partite = partiteDaEventi(JSON.parse(json));
  if (classifica.length === 0 && partite.length === 0) {
    throw new Error("CSI: risposta senza classifica né partite");
  }
  return { classifica, partite, girone: CSI_GIRONE, aggiornato: new Date().toISOString() };
}

export const Route = createFileRoute("/api/public/csi")({
  server: {
    handlers: {
      GET: async () => {
        if (cache && Date.now() < scadenza) return Response.json(cache);
        try {
          cache = await leggiCsi();
          scadenza = Date.now() + SCADENZA_MS;
        } catch (error) {
          console.error("csi", error);
          // Meglio un dato vecchio che nessun dato: il portale CSI cambia raramente.
          if (!cache) return new Response("CSI non raggiungibile", { status: 503 });
        }
        return Response.json(cache);
      },
    },
  },
});

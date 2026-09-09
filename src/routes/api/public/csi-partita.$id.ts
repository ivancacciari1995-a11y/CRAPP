import { createFileRoute } from "@tanstack/react-router";
import {
  parseFormazioni,
  parseInfoPartita,
  parsePrecedenti,
  urlPartitaFormazioni,
  urlPartitaInfo,
  urlPartitaPrecedenti,
  type DettaglioPartitaCsi,
} from "@/lib/csi-core";

const SCADENZA_MS = 6 * 60 * 60 * 1000;

// Una gara giocata non cambia più: la cache per-partita non ha bisogno di scadere mai
// per i dati storici, ma teniamo la stessa finestra di /api/public/csi per semplicità e
// per non tenere in memoria per sempre partite che nessuno riguarda più. Stessa cache in
// memoria del processo, stesso limite (si perde ai cold start): vedi limite 3 in
// docs/modules/collegamento-csi.md.
const cache = new Map<string, { dati: DettaglioPartitaCsi; scadenza: number }>();

async function scarica(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "CrAPP/1.0 (+https://crapvolley.it)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`CSI ${res.status} su ${url}`);
  return res.text();
}

async function leggiDettaglioPartita(matchId: string): Promise<DettaglioPartitaCsi> {
  const [main, players, stats] = await Promise.all([
    scarica(urlPartitaInfo(matchId)),
    scarica(urlPartitaFormazioni(matchId)),
    scarica(urlPartitaPrecedenti(matchId)),
  ]);
  return {
    ...parseInfoPartita(main),
    formazioni: parseFormazioni(players),
    precedenti: parsePrecedenti(stats),
  };
}

export const Route = createFileRoute("/api/public/csi-partita/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const matchId = params.id;
        const voce = cache.get(matchId);
        if (voce && Date.now() < voce.scadenza) return Response.json(voce.dati);
        try {
          const dati = await leggiDettaglioPartita(matchId);
          cache.set(matchId, { dati, scadenza: Date.now() + SCADENZA_MS });
          return Response.json(dati);
        } catch (error) {
          console.error("csi-partita", matchId, error);
          // Meglio un dato vecchio che nessun dato, come /api/public/csi.
          if (voce) return Response.json(voce.dati);
          return new Response("CSI non raggiungibile", { status: 503 });
        }
      },
    },
  },
});

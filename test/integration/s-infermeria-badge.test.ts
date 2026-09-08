/**
 * Badge segreto Cliente VIP dell'Infermeria end-to-end contro il database locale:
 * `bun test/integration/s-infermeria-badge.test.ts`.
 *
 * I test unitari (`test/unit/infortuni.test.ts`, `test/unit/badges.test.ts`) verificano
 * `contaInfortuni()` e `statoBadge()` come funzioni pure, con eventi e risposte costruiti a
 * mano. Qui invece si scrivono eventi e risposte "infortunato" veri su `eventi_app`/
 * `risposte_presenze`, si rileggono via REST con la stessa forma di `daRiga()`/
 * `fetchPresenze()`, e si passa il risultato attraverso `contaInfortuni()` fino a
 * `statoBadge()` sul badge segreto `s-infermeria`: se una colonna cambia nome o la mappatura
 * si rompe, qui il badge torna sbagliato anche se i test unitari restano verdi.
 *
 * Gira solo sullo stack locale (`npx supabase start`) e cancella le proprie righe alla fine:
 * usa id con il prefisso `test-s-infermeria-badge`, che nessun dato vero può avere.
 */
import assert from "node:assert/strict";
import { badgeSegreti, statoBadge } from "@/lib/badges";
import { contaInfortuni } from "@/lib/infortuni";
import { daRiga, type RigaEvento, type Evento } from "@/lib/eventi";
import { giocatori, type Giocatore } from "@/lib/crapp-data";
import { statoLocale } from "../helpers/locale";
import { prova, riepilogo, salta } from "../helpers/prova";

const locale = statoLocale();

if (!locale) {
  salta(
    "badge Cliente VIP dell'Infermeria sul database",
    "stack locale non attivo (npx supabase start)",
  );
  riepilogo("s-infermeria-badge");
} else {
  const { url: URL_BASE, servizio: SERVIZIO } = locale;
  console.log(`badge Cliente VIP dell'Infermeria su ${URL_BASE}`);

  const PREFISSO = "test-s-infermeria-badge";
  const def = badgeSegreti.find((b) => b.id === "s-infermeria")!;
  const OGGI = "2099-01-01";

  const rest = (percorso: string, init?: RequestInit) =>
    fetch(`${URL_BASE}/rest/v1/${percorso}`, {
      ...init,
      headers: {
        apikey: SERVIZIO,
        Authorization: `Bearer ${SERVIZIO}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

  const dataEvento = (i: number) => {
    const d = new Date(Date.UTC(2020, 0, 1));
    d.setUTCDate(d.getUTCDate() + i - 1);
    return d.toISOString().slice(0, 10);
  };

  async function creaEvento(id: string, i: number) {
    const res = await rest("eventi_app", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id,
        tipo: "allenamento",
        titolo: `Evento ${id}`,
        data: dataEvento(i),
      }),
    });
    if (!res.ok) throw new Error(`creazione evento ${id}: ${res.status} ${await res.text()}`);
  }

  async function rispondi(eventoId: string, giocatoreId: string, stato: string) {
    const res = await rest("risposte_presenze?on_conflict=evento_id,giocatore_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ evento_id: eventoId, giocatore_id: giocatoreId, stato }),
    });
    if (!res.ok) throw new Error(`upsert su risposte_presenze: ${res.status} ${await res.text()}`);
  }

  async function leggiEventi(): Promise<Evento[]> {
    const res = await rest(
      "eventi_app?id=like." +
        PREFISSO +
        "*&select=id,tipo,titolo,luogo,data,ora,note,convocati,campionato,casa,pagelle_chiuse,creato_il",
    );
    const righe = (await res.json()) as RigaEvento[];
    return righe.map(daRiga);
  }

  async function leggiPresenze(): Promise<Record<string, Record<string, string>>> {
    const res = await rest(
      `risposte_presenze?evento_id=like.${PREFISSO}*&select=evento_id,giocatore_id,stato`,
    );
    const righe = (await res.json()) as Array<{
      evento_id: string;
      giocatore_id: string;
      stato: string;
    }>;
    const mappa: Record<string, Record<string, string>> = {};
    for (const r of righe) (mappa[r.evento_id] ??= {})[r.giocatore_id] = r.stato;
    return mappa;
  }

  function giocatoreAzzerato(infortuni: number): Giocatore {
    return {
      ...giocatori[0]!,
      infortuni,
      mvp: 0,
      mediaVoto: 0,
      votiPagella: 0,
      palloni: 0,
      presenze: 0,
    };
  }

  try {
    await prova("il segreto si sblocca al terzo infortunio vero, non prima", async () => {
      for (let i = 1; i <= 3; i += 1) {
        const id = `${PREFISSO}-e${i}`;
        await creaEvento(id, i);
        await rispondi(id, "si1", "infortunato");
      }

      const eventiA2 = (await leggiEventi()).filter((e) => e.id !== `${PREFISSO}-e3`);
      const presenzeA2 = await leggiPresenze();
      const contoA2 = contaInfortuni(presenzeA2, eventiA2, OGGI)["si1"] ?? 0;
      assert.equal(contoA2, 2, "solo i primi due eventi contati");
      assert.equal(
        statoBadge(def, giocatoreAzzerato(contoA2)).grado,
        null,
        "2 infortuni non bastano",
      );

      const eventi = await leggiEventi();
      const presenze = await leggiPresenze();
      const conto = contaInfortuni(presenze, eventi, OGGI)["si1"] ?? 0;
      assert.equal(conto, 3);
      assert.equal(
        statoBadge(def, giocatoreAzzerato(conto)).grado,
        "oro",
        "3 infortuni: il segreto si sblocca (soglia unica)",
      );
    });
  } finally {
    await rest(`risposte_presenze?evento_id=like.${PREFISSO}*`, { method: "DELETE" });
    await rest(`eventi_app?id=like.${PREFISSO}*`, { method: "DELETE" });
  }

  riepilogo("s-infermeria-badge");
}

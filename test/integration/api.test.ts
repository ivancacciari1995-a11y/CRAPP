/**
 * Integrazione delle route server: `bun test/integration/api.test.ts`.
 * Avvia il server di sviluppo (o usa BASE_URL) e chiama gli endpoint veri.
 * Nessun test scrive sul database: solo letture e validazioni.
 */
import assert from "node:assert/strict";
import { isNostraSquadra, type DatiCsi } from "@/lib/csi-core";
import { avviaServer, haSupabase, json } from "../helpers/server";
import { prova, riepilogo, salta } from "../helpers/prova";

const server = await avviaServer();
const url = (p: string) => `${server.baseUrl}${p}`;
const postJson = (p: string, body: unknown) =>
  fetch(url(p), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

console.log(`integrazione API su ${server.baseUrl}`);

try {
  // --- GET /api/public/csi ---------------------------------------------------
  let csi: DatiCsi | undefined;

  await prova("GET /api/public/csi restituisce classifica e partite", async () => {
    const res = await fetch(url("/api/public/csi"));
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    csi = (await json(res)) as DatiCsi;
    assert.ok(Array.isArray(csi.classifica) && csi.classifica.length > 0);
    assert.ok(Array.isArray(csi.partite) && csi.partite.length > 0);
    assert.equal(csi.girone, "Girone B");
    assert.ok(!Number.isNaN(Date.parse(csi.aggiornato)), "timestamp valido");
  });

  await prova("la classifica contiene la nostra squadra con dati coerenti", () => {
    const noi = csi?.classifica.find((r) => isNostraSquadra(r.squadra));
    assert.ok(noi, "C.R.A.P. Volley presente in classifica");
    assert.equal(noi.vinte + noi.perse, noi.giocate, "vinte + perse = giocate");
    assert.ok(noi.punti >= 0 && noi.pos > 0);
    const posizioni = csi!.classifica.map((r) => r.pos);
    assert.deepEqual(
      posizioni,
      [...posizioni].sort((a, b) => a - b),
      "ordinata per posizione",
    );
  });

  await prova("ogni partita è coerente con il formato dell'app", () => {
    for (const p of csi?.partite ?? []) {
      assert.match(p.data, /^\d{4}-\d{2}-\d{2}$/, `${p.id}: data ISO`);
      assert.ok(p.avversario.length > 0, `${p.id}: avversario valorizzato`);
      assert.ok(!isNostraSquadra(p.avversario), `${p.id}: non giochiamo contro noi stessi`);
      const giocata = p.setNostri !== null && p.setLoro !== null;
      if (giocata) assert.equal(Math.max(p.setNostri!, p.setLoro!), 3, `${p.id}: si vince a 3 set`);
      else assert.equal(p.parziali.length, 0, `${p.id}: gara futura senza parziali`);
    }
  });

  await prova("la seconda chiamata arriva dalla cache del server", async () => {
    const t0 = Date.now();
    const secondo = (await json(await fetch(url("/api/public/csi")))) as DatiCsi;
    assert.equal(secondo.aggiornato, csi?.aggiornato, "stesso timestamp: nessuna nuova fetch");
    assert.ok(Date.now() - t0 < 2_000, "risposta immediata");
  });

  // --- GET /api/public/push-config -------------------------------------------
  await prova("GET /api/public/push-config espone solo la chiave pubblica", async () => {
    const res = await fetch(url("/api/public/push-config"));
    assert.equal(res.status, 200);
    const dati = (await json(res)) as Record<string, unknown>;
    assert.deepEqual(Object.keys(dati), ["publicKey"], "nessun altro dato esposto");
    assert.ok(dati["publicKey"] === null || typeof dati["publicKey"] === "string");
  });

  // --- validazione degli input (nessuna scrittura) ---------------------------
  await prova("push-subscribe rifiuta i payload non validi", async () => {
    assert.equal((await postJson("/api/public/push-subscribe", {})).status, 400);
    assert.equal(
      (
        await postJson("/api/public/push-subscribe", {
          endpoint: "non-un-url",
          giocatoreId: "g1",
          p256dh: "x",
          auth: "y",
        })
      ).status,
      400,
      "endpoint deve essere un URL",
    );
    assert.equal(
      (
        await postJson("/api/public/push-subscribe", {
          endpoint: `https://push.example/${"x".repeat(1100)}`,
          giocatoreId: "g1",
          p256dh: "x",
          auth: "y",
        })
      ).status,
      400,
      "endpoint troppo lungo",
    );
    const res = await fetch(url("/api/public/push-subscribe"), {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400, "anche la cancellazione valida l'input");
  });

  await prova("push-messaggio rifiuta i payload non validi", async () => {
    assert.equal((await postJson("/api/public/push-messaggio", {})).status, 400);
  });

  // --- le route che mandano notifiche a tutti (DD-024) ------------------------
  // Il controllo di accesso viene prima della validazione: senza credenziali la
  // risposta non deve nemmeno dire se l'evento esiste.
  await prova("le route che avvisano la squadra chiedono le credenziali", async () => {
    for (const percorso of ["/api/public/sollecita-presenze", "/api/public/apri-sondaggio"]) {
      assert.equal(
        (await postJson(percorso, { eventoId: "non-esiste" })).status,
        401,
        `${percorso} senza token`,
      );
    }
    assert.equal(
      (await postJson("/api/public/promemoria-palloni", {})).status < 400,
      false,
      "promemoria-palloni senza segreto non parte",
    );
  });

  await prova("un token malformato non passa", async () => {
    const res = await fetch(url("/api/public/sollecita-presenze"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer non-un-jwt" },
      body: JSON.stringify({ eventoId: "non-esiste" }),
    });
    assert.equal(res.status, 401, "tre segmenti separati da punto, o niente");
  });

  await prova("uno schema diverso da Bearer non passa", async () => {
    const res = await fetch(url("/api/public/sollecita-presenze"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Basic aGVsbG86d29ybGQ=" },
      body: JSON.stringify({ eventoId: "non-esiste" }),
    });
    assert.equal(res.status, 401);
  });

  // --- endpoint che leggono dal database -------------------------------------
  if (haSupabase()) {
    await prova("push-messaggio risponde con il messaggio di default", async () => {
      const res = await postJson("/api/public/push-messaggio", {
        endpoint: `https://push.example/test-${Date.now()}`,
      });
      assert.equal(res.status, 200);
      const dati = (await json(res)) as { title?: string; body?: string };
      assert.ok(dati.title && dati.body, "un endpoint sconosciuto riceve comunque un testo");
    });

    // La validazione dell'input di sollecita-presenze (400 sul corpo vuoto, 404
    // sull'evento inesistente) ora sta dietro al controllo di accesso: serve un
    // token di amministratore, che questo file non ha. La copre
    // `permessi-route.test.ts` sullo stack locale.
  } else {
    salta("endpoint con database", "SUPABASE_URL/SERVICE_ROLE_KEY non configurate");
  }

  // --- metodi non previsti ---------------------------------------------------
  await prova("un GET su un endpoint POST non esegue l'handler", async () => {
    const res = await fetch(url("/api/public/sollecita-presenze"));
    // TanStack Start serve la pagina invece del 405: l'importante è che il
    // job non parta e che nessuna notifica venga inviata.
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    assert.doesNotMatch(await res.text(), /"inviate"/);
  });

  riepilogo("integrazione API");
} finally {
  server.stop();
}

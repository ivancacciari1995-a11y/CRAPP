/**
 * Percorsi end-to-end sull'app servita davvero: `bun test/e2e/percorsi.test.ts`.
 * Verifica il giro completo route → server → dati → risposta HTTP.
 *
 * L'app renderizza i contenuti dopo l'idratazione: il server invia il guscio
 * (titolo, meta, splash) e il resto arriva nel browser. Qui si verifica quindi
 * tutto ciò che è osservabile senza browser; per i contenuti renderizzati
 * servirebbe un driver tipo Playwright.
 */
import assert from "node:assert/strict";
import { isNostraSquadra, type DatiCsi } from "@/lib/csi-core";
import { avviaServer, json } from "../helpers/server";
import { prova, riepilogo } from "../helpers/prova";

const server = await avviaServer();
const url = (p: string) => `${server.baseUrl}${p}`;

async function pagina(percorso: string): Promise<string> {
  const res = await fetch(url(percorso));
  assert.equal(res.status, 200, `${percorso} deve rispondere 200`);
  assert.match(res.headers.get("content-type") ?? "", /text\/html/, `${percorso} è una pagina`);
  const html = await res.text();
  assert.doesNotMatch(html, /Errore imprevisto|h3 swallowed/i, `${percorso}: nessun errore server`);
  return html;
}

const titolo = (html: string) => /<title>(.*?)<\/title>/.exec(html)?.[1] ?? "";

console.log(`percorsi end-to-end su ${server.baseUrl}`);

try {
  // --- 1. Primo avvio: l'app si carica --------------------------------------
  await prova("la home serve il guscio dell'app con il proprio titolo", async () => {
    const html = await pagina("/");
    assert.match(titolo(html), /CrAPP/, "titolo della home");
    assert.match(html, /icon-192\.png/, "splash di caricamento");
    assert.match(html, /manifest\.webmanifest/, "manifest collegato: installabile come PWA");
    assert.match(html, /<meta name="description"/, "descrizione per la condivisione");
  });

  // --- 2. Ogni schermata ha la sua identità ----------------------------------
  await prova("ogni schermata risponde con il proprio titolo", async () => {
    const attesi: Array<[string, RegExp]> = [
      ["/benvenuto", /Benvenuto/],
      ["/squadra", /Squadra/],
      ["/classifica", /Classifica/],
      ["/calendario", /Calendario|CrAPP/],
      ["/profilo", /Profilo|CrAPP/],
      ["/eventi", /Eventi|CrAPP/],
      ["/scout", /Scout|CrAPP/],
      ["/admin", /Dashboard|CrAPP/],
    ];
    for (const [percorso, atteso] of attesi) {
      assert.match(titolo(await pagina(percorso)), atteso, `${percorso}: titolo corretto`);
    }
  });

  // --- 3. Campionato: dal portale CSI fino alla pagina -----------------------
  await prova("i dati ufficiali CSI arrivano fino alla pagina Campionato", async () => {
    const res = await fetch(url("/api/public/csi"));
    assert.equal(res.status, 200, "l'endpoint che alimenta la pagina risponde");
    const csi = (await json(res)) as DatiCsi;
    const noi = csi.classifica.find((r) => isNostraSquadra(r.squadra));
    assert.ok(noi, "la nostra squadra arriva dal portale");
    assert.ok(
      csi.partite.some((p) => p.setNostri !== null),
      "ci sono risultati giocati",
    );

    const html = await pagina("/classifica");
    assert.match(titolo(html), /Classifica campionato/);
    assert.doesNotMatch(html, /CSI Milano/, "nessun residuo dei dati demo nel guscio");
  });

  // --- 4. Dettaglio di un evento --------------------------------------------
  await prova("le pagine di dettaglio reggono un id inesistente", async () => {
    for (const percorso of ["/partita/non-esiste", "/allenamento/non-esiste"]) {
      const res = await fetch(url(percorso));
      assert.ok(res.status < 500, `${percorso}: nessun errore server (era ${res.status})`);
    }
  });

  // --- 5. Installazione come PWA e notifiche push ---------------------------
  await prova("i file necessari alla PWA sono serviti", async () => {
    const manifest = await fetch(url("/manifest.webmanifest"));
    assert.equal(manifest.status, 200);
    const dati = (await json(manifest)) as { name?: string; icons?: unknown[]; start_url?: string };
    assert.ok(dati.name?.includes("CrAPP"));
    assert.equal(dati.start_url, "/");
    assert.ok((dati.icons ?? []).length >= 2, "icone per l'installazione");

    for (const file of ["/push-sw.js", "/icon-192.png", "/icon-512.png", "/robots.txt"]) {
      assert.equal((await fetch(url(file))).status, 200, `${file} raggiungibile`);
    }
  });

  await prova("il service worker e la sua configurazione si parlano", async () => {
    const sw = await (await fetch(url("/push-sw.js"))).text();
    // DD-026: ora il worker riceve il testo cifrato, senza recuperarlo dalla rete.
    assert.match(sw, /event\.data\?\.json\(\)/, "legge il payload della push");
    assert.match(sw, /showNotification/, "il worker mostra la notifica");
    assert.doesNotMatch(
      sw,
      /\bfetch\s*\(|\/api\/public\/push-messaggio/,
      "mostrare la push non deve richiedere rete ad app chiusa",
    );
    const config = await fetch(url("/api/public/push-config"));
    assert.equal(config.status, 200, "la chiave pubblica VAPID è interrogabile");
  });

  // --- 6. Percorsi inesistenti ----------------------------------------------
  await prova("una rotta inesistente risponde 404 senza rompere l'app", async () => {
    const res = await fetch(url("/pagina-che-non-esiste"));
    assert.equal(res.status, 404);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  });

  riepilogo("percorsi end-to-end");
} finally {
  server.stop();
}

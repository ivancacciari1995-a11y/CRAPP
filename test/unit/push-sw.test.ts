/** Esegue il worker reale senza pagina, DOM, rete o stato lasciato dall'app. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const codice = readFileSync(new URL("../../public/push-sw.js", import.meta.url), "utf8");
type Evento = { data?: { json: () => unknown } | null; waitUntil: (p: Promise<unknown>) => void };

function avviaWorker() {
  const listener = new Map<string, (event: Evento) => void>();
  const notifiche: Array<{ titolo: string; opzioni: NotificationOptions }> = [];
  let completa: (() => void) | undefined;
  const mostrata = new Promise<void>((resolve) => (completa = resolve));
  const installata = Promise.resolve();
  const attivata = Promise.resolve();
  runInNewContext(codice, {
    self: {
      addEventListener: (nome: string, callback: (event: Evento) => void) =>
        listener.set(nome, callback),
      skipWaiting: () => installata,
      clients: {
        claim: () => attivata,
        matchAll: () => assert.fail("la push deve funzionare senza consultare finestre aperte"),
      },
      registration: {
        showNotification(titolo: string, opzioni: NotificationOptions) {
          notifiche.push({ titolo, opzioni });
          return mostrata;
        },
      },
    },
    fetch: () => assert.fail("nessuna rete per mostrare la notifica"),
  });
  return { listener, notifiche, mostrata, completa: completa!, installata, attivata };
}

// L'installazione e l'attivazione tengono vivo il worker fino al completamento.
const avvio = avviaWorker();
for (const [nome, promessa] of [
  ["install", avvio.installata],
  ["activate", avvio.attivata],
] as const) {
  let attesa: Promise<unknown> | undefined;
  avvio.listener.get(nome)!({ waitUntil: (p) => (attesa = p) });
  assert.equal(attesa, promessa, `${nome}: la promessa è collegata a waitUntil`);
  await attesa;
}

const casi: Array<{ data: Evento["data"]; titolo: string; testo: string }> = [
  {
    data: { json: () => ({ title: "🏐 Palloni", body: "Sabato tocca a te." }) },
    titolo: "🏐 Palloni",
    testo: "Sabato tocca a te.",
  },
  { data: null, titolo: "CrAPP", testo: "Apri l'app per i dettagli." },
  {
    data: {
      json: () => {
        throw new SyntaxError("payload non JSON");
      },
    },
    titolo: "CrAPP",
    testo: "Apri l'app per i dettagli.",
  },
];
for (const { data, titolo, testo } of casi) {
  // Nuovo contesto a ogni consegna: simula il risveglio dopo la terminazione del worker.
  const worker = avviaWorker();
  let attesa: Promise<unknown> | undefined;
  worker.listener.get("push")!({ data, waitUntil: (p) => (attesa = p) });
  assert.equal(worker.notifiche.length, 1, "mostra subito una notifica anche senza l'app");
  assert.equal(attesa, worker.mostrata, "waitUntil copre tutta showNotification");
  const notifica = worker.notifiche[0]!;
  assert.equal(notifica.titolo, titolo);
  assert.equal(notifica.opzioni.body, testo);
  assert.ok(notifica.opzioni.tag, "il tag permette di sostituire la notifica precedente");
  assert.equal(notifica.opzioni.renotify, true, "anche una sostituzione avvisa l'utente");
  worker.completa();
  await attesa;
}

console.log("push-sw: ok");

/** Logica pura del worker email (M22): `bun test/unit/mailer-core.test.ts`. Nessuna rete né SMTP. */
import assert from "node:assert/strict";
import {
  MAX_TENTATIVI,
  classificaErroreSmtp,
  classificaStatoPush,
  componiMail,
  descriviErrore,
  elaboraCiclo,
  elaboraCicloPush,
  escapeHtml,
  invioConsentiti,
  leggiConfig,
  linkNotifica,
  messageId,
  pulisciOggetto,
  ritardoRiprova,
  staSano,
  type Dipendenze,
  type DipendenzePush,
  type EsitoInvio,
  type EsitoPush,
  type IscrizionePush,
  type MailComposta,
  type NotificaEmail,
  type PushDaInviare,
} from "../../mailer/mailer-core.ts";
import { prova, riepilogo } from "../helpers/prova";

const ENV_BASE = {
  SUPABASE_URL: "https://x.supabase.co/",
  SUPABASE_SERVICE_ROLE_KEY: "chiave",
  SMTP_USER: "crapp@gmail.com",
  SMTP_PASS: "password-per-app",
  APP_URL: "https://crapp.example/",
};

// --- leggiConfig --------------------------------------------------------------
await prova("configurazione completa: default, slash finali tolti, From = SMTP_USER", () => {
  const r = leggiConfig(ENV_BASE);
  assert.ok("config" in r);
  const c = r.config;
  assert.equal(c.supabaseUrl, "https://x.supabase.co");
  assert.equal(c.appUrl, "https://crapp.example");
  assert.equal(c.from, "crapp@gmail.com");
  assert.equal(c.fromName, "CrAPP");
  assert.deepEqual(c.smtp, {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: "crapp@gmail.com", pass: "password-per-app" },
  });
  assert.equal(c.pollSecondi, 30);
  assert.equal(c.limiteGiorno, 400);
  assert.equal(c.lotto, 10);
});

await prova("elenca insieme tutte le variabili mancanti", () => {
  const r = leggiConfig({});
  assert.ok("errori" in r);
  assert.deepEqual(r.errori, [
    "SUPABASE_URL mancante",
    "SUPABASE_SERVICE_ROLE_KEY mancante",
    "APP_URL mancante",
    "MAIL_FROM mancante (o SMTP_USER)",
  ]);
});

await prova("SMTP_USER e SMTP_PASS vanno insieme", () => {
  const r = leggiConfig({ ...ENV_BASE, SMTP_PASS: "" });
  assert.ok("errori" in r);
  assert.ok(r.errori.includes("SMTP_USER e SMTP_PASS vanno impostati insieme"));
});

await prova("senza credenziali SMTP (server di prova) serve MAIL_FROM e non c'è auth", () => {
  const { SMTP_USER: _u, SMTP_PASS: _p, ...senza } = ENV_BASE;
  assert.ok("errori" in leggiConfig(senza));
  const r = leggiConfig({ ...senza, MAIL_FROM: "prova@crapp.local", SMTP_PORT: "1025" });
  assert.ok("config" in r);
  assert.equal(r.config.smtp.auth, null);
  assert.equal(r.config.smtp.port, 1025);
});

await prova("un numero non valido è un errore, non un default silenzioso", () => {
  for (const valore of ["0", "-5", "abc", "1.5"]) {
    const r = leggiConfig({ ...ENV_BASE, POLL_SECONDI: valore });
    assert.ok("errori" in r, valore);
    assert.deepEqual(r.errori, ["POLL_SECONDI deve essere un intero positivo"]);
  }
});

// --- classificaErroreSmtp -----------------------------------------------------
await prova("il tetto giornaliero di Gmail non è un errore permanente", () => {
  const errore = {
    responseCode: 550,
    response: "550-5.4.5 Daily user sending quota exceeded.",
  };
  assert.equal(classificaErroreSmtp(errore), "limite");
});

await prova("credenziali rifiutate: configurazione, non colpa della mail", () => {
  assert.equal(classificaErroreSmtp({ code: "EAUTH", responseCode: 535 }), "configurazione");
  assert.equal(classificaErroreSmtp({ responseCode: 534 }), "configurazione");
});

await prova("5xx sul destinatario e indirizzo non valido sono permanenti", () => {
  assert.equal(
    classificaErroreSmtp({ responseCode: 550, response: "550 no such user" }),
    "permanente",
  );
  assert.equal(classificaErroreSmtp({ code: "EENVELOPE" }), "permanente");
});

await prova("4xx e errori di rete sono temporanei", () => {
  assert.equal(classificaErroreSmtp({ responseCode: 421 }), "temporaneo");
  assert.equal(classificaErroreSmtp({ code: "ETIMEDOUT" }), "temporaneo");
  assert.equal(classificaErroreSmtp({ code: "ECONNECTION" }), "temporaneo");
  assert.equal(classificaErroreSmtp(new Error("boh")), "temporaneo");
  assert.equal(classificaErroreSmtp(null), "temporaneo");
});

await prova("descriviErrore riporta solo codici, mai il testo della risposta", () => {
  const errore = { code: "EMESSAGE", responseCode: 550, response: "550 nome@gmail.com non esiste" };
  assert.equal(descriviErrore(errore), "EMESSAGE 550");
  assert.equal(descriviErrore(new Error("mario@gmail.com")), "errore sconosciuto");
});

// --- backoff e tetto ----------------------------------------------------------
await prova("backoff 1 · 5 · 30 · 120 minuti, poi nessun altro tentativo", () => {
  assert.deepEqual([0, 1, 2, 3].map(ritardoRiprova), [1, 5, 30, 120]);
  assert.equal(ritardoRiprova(4), null);
  assert.equal(MAX_TENTATIVI, 5);
});

await prova("invioConsentiti non supera né il lotto né il tetto delle 24 ore", () => {
  assert.equal(invioConsentiti(400, 0, 10), 10);
  assert.equal(invioConsentiti(400, 395, 10), 5);
  assert.equal(invioConsentiti(400, 400, 10), 0);
  assert.equal(invioConsentiti(400, 450, 10), 0);
});

await prova("staSano: sano solo con un ciclo riuscito abbastanza recente", () => {
  assert.equal(staSano(null, 1_000_000, 300_000), false);
  assert.equal(staSano(900_000, 1_000_000, 300_000), true);
  assert.equal(staSano(600_000, 1_000_000, 300_000), false);
});

// --- composizione della mail --------------------------------------------------
const notifica = (extra: Partial<NotificaEmail> = {}): NotificaEmail => ({
  id_notifica: "n-1",
  destinatario: "mario@gmail.com",
  oggetto: "Promemoria: Allenamento",
  testo: "30/09/2026 alle 20:30",
  id_evento: "ev-1",
  tipo_notifica: "evento_promemoria_24h",
  tentativi_fatti: 0,
  ...extra,
});
const OPZ = { appUrl: "https://crapp.example", dominioMessageId: "gmail.com" };

await prova("link: scheda evento se c'è, altrimenti la home; id codificato", () => {
  assert.equal(linkNotifica("https://a.it/", "ev-1"), "https://a.it/evento/ev-1");
  assert.equal(linkNotifica("https://a.it", null), "https://a.it");
  assert.equal(linkNotifica("https://a.it", "a b/c"), "https://a.it/evento/a%20b%2Fc");
});

await prova("Message-ID deterministico per notifica", () => {
  assert.equal(messageId("abc", "gmail.com"), "<abc@gmail.com>");
  assert.equal(componiMail(notifica(), OPZ).messageId, componiMail(notifica(), OPZ).messageId);
});

await prova("oggetto su una riga sola, con un tetto e un ripiego", () => {
  assert.equal(pulisciOggetto("Ciao\r\nBcc: x@y.it"), "Ciao Bcc: x@y.it");
  assert.equal(pulisciOggetto("   "), "Notifica CrAPP");
  assert.equal(pulisciOggetto("a".repeat(500)).length, 200);
});

await prova("la mail ha testo, HTML, link all'evento e come disattivarle", () => {
  const m = componiMail(notifica(), OPZ);
  assert.equal(m.to, "mario@gmail.com");
  assert.equal(m.subject, "Promemoria: Allenamento");
  assert.match(m.text, /30\/09\/2026 alle 20:30/);
  assert.match(m.text, /https:\/\/crapp\.example\/evento\/ev-1/);
  assert.match(m.text, /Profilo → Opzioni → Email/);
  assert.match(m.html, /href="https:\/\/crapp\.example\/evento\/ev-1"/);
  assert.match(m.html, /Apri CrAPP/);
});

await prova("il testo dell'admin non inietta HTML e conserva gli a-capo", () => {
  const m = componiMail(
    notifica({ testo: `<img src=x onerror=alert(1)>\nriga "2"`, id_evento: null }),
    OPZ,
  );
  assert.ok(!m.html.includes("<img"));
  assert.match(m.html, /&lt;img src=x onerror=alert\(1\)&gt;<br>riga &quot;2&quot;/);
  assert.match(m.html, /href="https:\/\/crapp\.example"/);
  assert.equal(escapeHtml(`<&>"'`), "&lt;&amp;&gt;&quot;&#39;");
});

await prova(
  "il corpo a righe etichettate delle notifiche automatiche (DD-040) resta leggibile",
  () => {
    const corpo = "Data: domani, 01/10/2026\nOra: 21:00\nLuogo: PalaCRAP";
    const m = componiMail(
      notifica({
        oggetto: "Promemoria evento di domani: Allenamento",
        testo: corpo,
        id_evento: "ev-1",
      }),
      OPZ,
    );
    assert.equal(m.subject, "Promemoria evento di domani: Allenamento");
    assert.ok(m.text.startsWith(`${corpo}\n\nApri CrAPP: `), "in testo semplice le righe restano");
    assert.match(m.html, /Data: domani, 01\/10\/2026<br>Ora: 21:00<br>Luogo: PalaCRAP/);
  },
);

await prova("titolo con HTML: l'intestazione della mail è sempre esclusa dal markup", () => {
  const m = componiMail(notifica({ oggetto: "<b>Ciao</b>" }), OPZ);
  assert.ok(!m.html.includes("<b>"));
});

await prova("corpo vuoto: niente paragrafo vuoto", () => {
  const m = componiMail(notifica({ testo: "" }), OPZ);
  assert.ok(!m.html.includes('<p style="margin:0 0 16px"></p>'));
  assert.ok(!m.text.startsWith("\n"));
});

// --- elaboraCiclo -------------------------------------------------------------
type Chiamata = { id: string; esito: EsitoInvio; errore?: string; prossimo?: Date };

function ambiente(opzioni: {
  lotto?: NotificaEmail[];
  inviate24h?: number;
  invia?: (mail: MailComposta) => Promise<void>;
  segna?: Dipendenze["segna"];
}) {
  const chiamate: Chiamata[] = [];
  const inviate: MailComposta[] = [];
  const log: string[] = [];
  let richiesto = -1;
  const ADESSO = new Date("2026-09-29T10:00:00Z");
  const dip: Dipendenze = {
    prendi: async (max) => {
      richiesto = max;
      return opzioni.lotto ?? [];
    },
    segna:
      opzioni.segna ??
      (async (id, esito, errore, prossimo) => {
        chiamate.push({
          id,
          esito,
          ...(errore !== undefined ? { errore } : {}),
          ...(prossimo ? { prossimo } : {}),
        });
      }),
    invia:
      opzioni.invia ??
      (async (mail) => {
        inviate.push(mail);
      }),
    inviateUltime24h: async () => opzioni.inviate24h ?? 0,
    adesso: () => ADESSO,
    log: (m) => log.push(m),
  };
  return { dip, chiamate, inviate, log, ADESSO, richiesto: () => richiesto };
}
const OPZ_CICLO = { limiteGiorno: 400, lotto: 10, ...OPZ };

await prova("ciclo: invia ogni mail e segna 'inviata'", async () => {
  const a = ambiente({ lotto: [notifica({ id_notifica: "a" }), notifica({ id_notifica: "b" })] });
  const r = await elaboraCiclo(a.dip, OPZ_CICLO);
  assert.equal(r.inviate, 2);
  assert.deepEqual(
    a.chiamate.map((c) => [c.id, c.esito]),
    [
      ["a", "inviata"],
      ["b", "inviata"],
    ],
  );
  assert.equal(a.inviate.length, 2);
});

await prova("ciclo: chiede al massimo quanto consente il tetto giornaliero", async () => {
  const a = ambiente({ inviate24h: 396 });
  await elaboraCiclo(a.dip, OPZ_CICLO);
  assert.equal(a.richiesto(), 4);
});

await prova("ciclo: tetto raggiunto, non prende nulla dalla coda", async () => {
  const a = ambiente({ inviate24h: 400, lotto: [notifica()] });
  const r = await elaboraCiclo(a.dip, OPZ_CICLO);
  assert.equal(r.fermato, "limite");
  assert.equal(a.richiesto(), -1);
  assert.equal(a.chiamate.length, 0);
});

await prova("ciclo: errore temporaneo, riprova con backoff sul numero di tentativi", async () => {
  const a = ambiente({
    lotto: [notifica({ id_notifica: "a", tentativi_fatti: 2 })],
    invia: async () => {
      throw { code: "ETIMEDOUT" };
    },
  });
  const r = await elaboraCiclo(a.dip, OPZ_CICLO);
  assert.equal(r.riprovate, 1);
  const [c] = a.chiamate;
  assert.equal(c?.esito, "riprova");
  assert.equal(c?.prossimo?.getTime(), a.ADESSO.getTime() + 30 * 60_000);
});

await prova("ciclo: all'ultimo tentativo l'errore temporaneo diventa 'fallita'", async () => {
  const a = ambiente({
    lotto: [notifica({ id_notifica: "a", tentativi_fatti: 4 })],
    invia: async () => {
      throw { responseCode: 421 };
    },
  });
  const r = await elaboraCiclo(a.dip, OPZ_CICLO);
  assert.equal(r.fallite, 1);
  assert.equal(a.chiamate[0]?.esito, "fallita");
});

await prova("ciclo: errore permanente, subito 'fallita' senza riprovare", async () => {
  const a = ambiente({
    lotto: [notifica({ id_notifica: "a" })],
    invia: async () => {
      throw { responseCode: 550, response: "550 no such user" };
    },
  });
  await elaboraCiclo(a.dip, OPZ_CICLO);
  assert.equal(a.chiamate[0]?.esito, "fallita");
  assert.equal(a.chiamate[0]?.errore, "550");
});

await prova("ciclo: una mail fallita non ferma le successive", async () => {
  const a = ambiente({
    lotto: [notifica({ id_notifica: "a" }), notifica({ id_notifica: "b" })],
    invia: async (mail) => {
      if (mail.messageId.startsWith("<a@")) throw { responseCode: 550 };
    },
  });
  const r = await elaboraCiclo(a.dip, OPZ_CICLO);
  assert.equal(r.fallite, 1);
  assert.equal(r.inviate, 1);
  assert.equal(r.fermato, null);
});

await prova(
  "ciclo: tetto Gmail a metà lotto, rimanda questa e le successive e si ferma",
  async () => {
    let n = 0;
    const a = ambiente({
      lotto: [
        notifica({ id_notifica: "a" }),
        notifica({ id_notifica: "b" }),
        notifica({ id_notifica: "c" }),
      ],
      invia: async () => {
        n += 1;
        if (n === 2)
          throw { responseCode: 550, response: "550-5.4.5 Daily user sending quota exceeded" };
      },
    });
    const r = await elaboraCiclo(a.dip, OPZ_CICLO);
    assert.equal(r.fermato, "limite");
    assert.equal(r.inviate, 1);
    assert.equal(r.differite, 2);
    assert.deepEqual(
      a.chiamate.map((c) => [c.id, c.esito]),
      [
        ["a", "inviata"],
        ["b", "differita"],
        ["c", "differita"],
      ],
    );
    assert.equal(a.chiamate[1]?.prossimo?.getTime(), a.ADESSO.getTime() + 60 * 60_000);
  },
);

await prova(
  "ciclo: credenziali SMTP rifiutate, tutto differito senza consumare tentativi",
  async () => {
    const a = ambiente({
      lotto: [notifica({ id_notifica: "a" }), notifica({ id_notifica: "b" })],
      invia: async () => {
        throw { code: "EAUTH", responseCode: 535 };
      },
    });
    const r = await elaboraCiclo(a.dip, OPZ_CICLO);
    assert.equal(r.fermato, "configurazione");
    assert.deepEqual(
      a.chiamate.map((c) => c.esito),
      ["differita", "differita"],
    );
    assert.equal(r.fallite, 0);
  },
);

await prova(
  "ciclo: se la registrazione dell'esito fallisce non si riprova la mail già inviata",
  async () => {
    const a = ambiente({
      lotto: [notifica({ id_notifica: "a" })],
      segna: async () => {
        throw new Error("rete giù");
      },
    });
    await assert.rejects(elaboraCiclo(a.dip, OPZ_CICLO), /rete giù/);
    assert.equal(a.inviate.length, 1);
  },
);

await prova("ciclo: i log non contengono indirizzi né testi", async () => {
  const a = ambiente({
    lotto: [notifica({ id_notifica: "a" }), notifica({ id_notifica: "b" })],
    invia: async (mail) => {
      if (mail.messageId.startsWith("<b@"))
        throw { responseCode: 550, response: "550 mario@gmail.com" };
    },
  });
  await elaboraCiclo(a.dip, OPZ_CICLO);
  const tutto = a.log.join("\n");
  assert.ok(!tutto.includes("mario@gmail.com"));
  assert.ok(!tutto.includes("30/09/2026"));
  assert.ok(!tutto.includes("Allenamento"));
});

// --- Configurazione VAPID (M24) -----------------------------------------------
await prova("senza chiavi VAPID il worker parte e manda solo le email", () => {
  const r = leggiConfig(ENV_BASE);
  assert.ok("config" in r);
  assert.equal(r.config.vapid, null);
});

await prova("con le chiavi VAPID la push dei promemoria è attiva", () => {
  const r = leggiConfig({
    ...ENV_BASE,
    VAPID_PUBLIC_KEY: "pub",
    VAPID_PRIVATE_KEY: "priv",
    VAPID_SUBJECT: "mailto:a@b.it",
  });
  assert.ok("config" in r);
  assert.deepEqual(r.config.vapid, {
    publicKey: "pub",
    privateKey: "priv",
    subject: "mailto:a@b.it",
  });
});

await prova("le chiavi VAPID vanno impostate insieme", () => {
  for (const env of [{ VAPID_PUBLIC_KEY: "pub" }, { VAPID_PRIVATE_KEY: "priv" }]) {
    const r = leggiConfig({ ...ENV_BASE, ...env });
    assert.ok("errori" in r);
    assert.deepEqual(r.errori, ["VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY vanno impostate insieme"]);
  }
});

// --- classificaStatoPush ------------------------------------------------------
await prova("stato HTTP del servizio push: accettata, scaduta, temporanea, permanente", () => {
  for (const s of [200, 201, 202]) assert.equal(classificaStatoPush(s), "ok", String(s));
  for (const s of [404, 410]) assert.equal(classificaStatoPush(s), "scaduta", String(s));
  for (const s of [429, 500, 502, 503])
    assert.equal(classificaStatoPush(s), "temporaneo", String(s));
  for (const s of [400, 401, 403, 413])
    assert.equal(classificaStatoPush(s), "permanente", String(s));
});

// --- elaboraCicloPush ---------------------------------------------------------
const disp = (n: number): IscrizionePush[] =>
  Array.from({ length: n }, (_, i) => ({
    endpoint: `https://push.example/${i}`,
    p256dh: "k",
    auth: "a",
  }));
const pushDa = (extra: Partial<PushDaInviare> = {}): PushDaInviare => ({
  id_notifica: "p-1",
  oggetto: "Promemoria: Allenamento",
  testo: "30/09/2026 alle 20:30",
  tentativi_fatti: 0,
  iscrizioni: disp(1),
  ...extra,
});

type ChiamataPush = { id: string; esito: EsitoPush; errore?: string; prossimo?: Date };

function ambientePush(opzioni: {
  lotto?: PushDaInviare[];
  risposta?: (iscrizione: IscrizionePush) => Promise<{ stato: number }>;
  elimina?: (endpoint: string) => Promise<void>;
}) {
  const chiamate: ChiamataPush[] = [];
  const inviate: Array<{ endpoint: string; titolo: string; testo: string }> = [];
  const eliminate: string[] = [];
  const log: string[] = [];
  const ADESSO = new Date("2026-09-29T10:00:00Z");
  const dip: DipendenzePush = {
    prendi: async () => opzioni.lotto ?? [],
    segna: async (id, esito, errore, prossimo) => {
      chiamate.push({
        id,
        esito,
        ...(errore !== undefined ? { errore } : {}),
        ...(prossimo ? { prossimo } : {}),
      });
    },
    invia: async (iscrizione, titolo, testo) => {
      inviate.push({ endpoint: iscrizione.endpoint, titolo, testo });
      return opzioni.risposta ? opzioni.risposta(iscrizione) : { stato: 201 };
    },
    elimina:
      opzioni.elimina ??
      (async (endpoint) => {
        eliminate.push(endpoint);
      }),
    adesso: () => ADESSO,
    log: (m) => log.push(m),
  };
  return { dip, chiamate, inviate, eliminate, log, ADESSO };
}

await prova("push: manda titolo e testo a tutti i dispositivi e segna 'inviata'", async () => {
  const a = ambientePush({ lotto: [pushDa({ iscrizioni: disp(2) })] });
  const r = await elaboraCicloPush(a.dip, { lotto: 10 });
  assert.equal(r.inviate, 1);
  assert.equal(a.inviate.length, 2);
  assert.equal(a.inviate[0]?.titolo, "Promemoria: Allenamento");
  assert.equal(a.inviate[0]?.testo, "30/09/2026 alle 20:30");
  assert.deepEqual(
    a.chiamate.map((c) => [c.id, c.esito]),
    [["p-1", "inviata"]],
  );
});

await prova("push: basta un dispositivo che accetta, quello scaduto viene eliminato", async () => {
  const a = ambientePush({
    lotto: [pushDa({ iscrizioni: disp(2) })],
    risposta: async (i) => ({ stato: i.endpoint.endsWith("/0") ? 410 : 201 }),
  });
  const r = await elaboraCicloPush(a.dip, { lotto: 10 });
  assert.equal(r.inviate, 1);
  assert.equal(r.iscrizioniRimosse, 1);
  assert.deepEqual(a.eliminate, ["https://push.example/0"]);
  assert.equal(a.chiamate[0]?.esito, "inviata");
});

await prova("push: tutte le iscrizioni scadute vuol dire 'saltata', non un errore", async () => {
  const a = ambientePush({
    lotto: [pushDa({ iscrizioni: disp(2) })],
    risposta: async () => ({ stato: 404 }),
  });
  const r = await elaboraCicloPush(a.dip, { lotto: 10 });
  assert.equal(r.saltate, 1);
  assert.equal(r.iscrizioniRimosse, 2);
  assert.equal(a.chiamate[0]?.esito, "saltata");
});

await prova("push: nessuna iscrizione nella riga, 'saltata' senza chiamate", async () => {
  const a = ambientePush({ lotto: [pushDa({ iscrizioni: [] })] });
  await elaboraCicloPush(a.dip, { lotto: 10 });
  assert.equal(a.inviate.length, 0);
  assert.equal(a.chiamate[0]?.esito, "saltata");
});

await prova("push: errore temporaneo, riprova con backoff sul numero di tentativi", async () => {
  const a = ambientePush({
    lotto: [pushDa({ tentativi_fatti: 1 })],
    risposta: async () => ({ stato: 503 }),
  });
  const r = await elaboraCicloPush(a.dip, { lotto: 10 });
  assert.equal(r.riprovate, 1);
  assert.equal(a.chiamate[0]?.esito, "riprova");
  assert.equal(a.chiamate[0]?.errore, "503");
  assert.equal(a.chiamate[0]?.prossimo?.getTime(), a.ADESSO.getTime() + 5 * 60_000);
});

await prova("push: rete giù, riprova; all'ultimo tentativo 'fallita'", async () => {
  const giu = async () => {
    throw new Error("rete");
  };
  const a = ambientePush({ lotto: [pushDa({ tentativi_fatti: 0 })], risposta: giu });
  await elaboraCicloPush(a.dip, { lotto: 10 });
  assert.equal(a.chiamate[0]?.esito, "riprova");
  assert.equal(a.chiamate[0]?.errore, "rete");
  const b = ambientePush({ lotto: [pushDa({ tentativi_fatti: 4 })], risposta: giu });
  const r = await elaboraCicloPush(b.dip, { lotto: 10 });
  assert.equal(r.fallite, 1);
  assert.equal(b.chiamate[0]?.esito, "fallita");
});

await prova("push: rifiuto permanente (chiavi VAPID sbagliate) è subito 'fallita'", async () => {
  const a = ambientePush({ lotto: [pushDa()], risposta: async () => ({ stato: 403 }) });
  const r = await elaboraCicloPush(a.dip, { lotto: 10 });
  assert.equal(r.fallite, 1);
  assert.equal(a.chiamate[0]?.esito, "fallita");
  assert.equal(a.chiamate[0]?.errore, "403");
});

await prova("push: una notifica che fallisce non ferma le successive", async () => {
  const a = ambientePush({
    lotto: [pushDa({ id_notifica: "p-1" }), pushDa({ id_notifica: "p-2", iscrizioni: disp(1) })],
    risposta: async () => ({ stato: 201 }),
  });
  a.dip.invia = async (_i, _t, _x) => {
    if (a.inviate.length === 0) {
      a.inviate.push({ endpoint: "x", titolo: "", testo: "" });
      throw new Error("rete");
    }
    return { stato: 201 };
  };
  const r = await elaboraCicloPush(a.dip, { lotto: 10 });
  assert.equal(r.riprovate, 1);
  assert.equal(r.inviate, 1);
});

await prova("push: se l'eliminazione dell'iscrizione fallisce, il resto prosegue", async () => {
  const a = ambientePush({
    lotto: [pushDa({ iscrizioni: disp(2) })],
    risposta: async (i) => ({ stato: i.endpoint.endsWith("/0") ? 410 : 201 }),
    elimina: async () => {
      throw new Error("db giù");
    },
  });
  const r = await elaboraCicloPush(a.dip, { lotto: 10 });
  assert.equal(r.inviate, 1);
  assert.equal(r.iscrizioniRimosse, 0);
});

await prova("push: la registrazione dell'esito che fallisce interrompe il ciclo", async () => {
  const a = ambientePush({ lotto: [pushDa()] });
  a.dip.segna = async () => {
    throw new Error("rete giù");
  };
  await assert.rejects(elaboraCicloPush(a.dip, { lotto: 10 }), /rete giù/);
});

await prova("push: i log non contengono endpoint né testi dei promemoria", async () => {
  const a = ambientePush({
    lotto: [pushDa({ iscrizioni: disp(2) }), pushDa({ id_notifica: "p-2" })],
    risposta: async (i) => ({ stato: i.endpoint.endsWith("/0") ? 410 : 503 }),
  });
  await elaboraCicloPush(a.dip, { lotto: 10 });
  const tutto = a.log.join("\n");
  assert.ok(!tutto.includes("push.example"));
  assert.ok(!tutto.includes("Allenamento"));
  assert.ok(!tutto.includes("20:30"));
});

riepilogo("mailer-core");

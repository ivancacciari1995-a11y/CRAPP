/** Logica pura del worker email (M22): `bun test/unit/mailer-core.test.ts`. Nessuna rete né SMTP. */
import assert from "node:assert/strict";
import {
  MAX_TENTATIVI,
  classificaErroreSmtp,
  componiMail,
  descriviErrore,
  elaboraCiclo,
  escapeHtml,
  invioConsentiti,
  leggiConfig,
  linkNotifica,
  messageId,
  pulisciOggetto,
  ritardoRiprova,
  staSano,
  type Dipendenze,
  type EsitoInvio,
  type MailComposta,
  type NotificaEmail,
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

riepilogo("mailer-core");

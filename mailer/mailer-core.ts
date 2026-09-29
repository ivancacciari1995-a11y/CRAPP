/**
 * Logica pura del worker email (M22, DD-036), separata da rete e SMTP per poterla testare:
 * configurazione, classificazione degli errori SMTP, backoff, composizione della mail e il
 * ciclo di invio con le dipendenze iniettate. `mailer.mjs` fa solo da colla.
 */

/** Riga restituita da `prendi_notifiche_email()`. */
export type NotificaEmail = {
  id_notifica: string;
  destinatario: string;
  oggetto: string;
  testo: string;
  id_evento: string | null;
  tipo_notifica: string;
  tentativi_fatti: number;
};

export type EsitoInvio = "inviata" | "riprova" | "differita" | "fallita";

export type MailComposta = {
  to: string;
  subject: string;
  text: string;
  html: string;
  messageId: string;
};

// --- Configurazione ---------------------------------------------------------------------------

export type Config = {
  supabaseUrl: string;
  serviceRoleKey: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string } | null;
  };
  from: string;
  fromName: string;
  appUrl: string;
  pollSecondi: number;
  limiteGiorno: number;
  lotto: number;
};

export type LetturaConfig = { config: Config } | { errori: string[] };

/**
 * Legge la configurazione dalle variabili d'ambiente. Torna tutti gli errori insieme (mancanti
 * e non validi) per correggere il `.env` in un solo giro. `SMTP_USER`/`SMTP_PASS` vanno o
 * entrambi o nessuno dei due: senza servono solo per un server di prova locale (Mailpit).
 */
export function leggiConfig(env: Record<string, string | undefined>): LetturaConfig {
  const errori: string[] = [];
  const testo = (nome: string): string => (env[nome] ?? "").trim();
  const obbligatoria = (nome: string): string => {
    const valore = testo(nome);
    if (!valore) errori.push(`${nome} mancante`);
    return valore;
  };
  const intero = (nome: string, predefinito: number): number => {
    const grezzo = testo(nome);
    if (!grezzo) return predefinito;
    const n = Number(grezzo);
    if (!Number.isInteger(n) || n <= 0) {
      errori.push(`${nome} deve essere un intero positivo`);
      return predefinito;
    }
    return n;
  };

  const supabaseUrl = obbligatoria("SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = obbligatoria("SUPABASE_SERVICE_ROLE_KEY");
  const appUrl = obbligatoria("APP_URL").replace(/\/+$/, "");
  const user = testo("SMTP_USER");
  const pass = testo("SMTP_PASS");
  if (Boolean(user) !== Boolean(pass)) errori.push("SMTP_USER e SMTP_PASS vanno impostati insieme");
  const from = testo("MAIL_FROM") || user;
  if (!from) errori.push("MAIL_FROM mancante (o SMTP_USER)");
  const porta = intero("SMTP_PORT", 587);
  const pollSecondi = intero("POLL_SECONDI", 30);
  const limiteGiorno = intero("MAIL_LIMITE_GIORNO", 400);
  const lotto = intero("MAIL_LOTTO", 10);

  if (errori.length > 0) return { errori };
  return {
    config: {
      supabaseUrl,
      serviceRoleKey,
      smtp: {
        host: testo("SMTP_HOST") || "smtp.gmail.com",
        port: porta,
        secure: testo("SMTP_SECURE") === "true",
        auth: user ? { user, pass } : null,
      },
      from,
      fromName: testo("MAIL_FROM_NAME") || "CrAPP",
      appUrl,
      pollSecondi,
      limiteGiorno,
      lotto,
    },
  };
}

// --- Errori SMTP e backoff --------------------------------------------------------------------

export type TipoErrore = "temporaneo" | "permanente" | "configurazione" | "limite";

type ErroreSmtp = { code?: unknown; responseCode?: unknown; response?: unknown; message?: unknown };

/**
 * Distingue cosa fare dopo un invio fallito:
 * - `limite`: tetto giornaliero di Gmail (`550 5.4.5 Daily user sending quota exceeded`, che
 *   sarebbe un 5xx "permanente" ma non dipende dalla mail): si rimanda senza contare un tentativo;
 * - `configurazione`: credenziali SMTP rifiutate; stessa cosa, e il worker si ferma;
 * - `permanente`: 5xx sul destinatario o sul messaggio, inutile riprovare;
 * - `temporaneo`: 4xx e errori di rete, si riprova con backoff.
 */
export function classificaErroreSmtp(errore: unknown): TipoErrore {
  const e = (typeof errore === "object" && errore !== null ? errore : {}) as ErroreSmtp;
  const codice = typeof e.code === "string" ? e.code : "";
  const risposta = typeof e.responseCode === "number" ? e.responseCode : 0;
  const testo = `${typeof e.response === "string" ? e.response : ""} ${
    typeof e.message === "string" ? e.message : ""
  }`.toLowerCase();

  if (/5\.4\.5|quota exceeded|sending limit/.test(testo)) return "limite";
  if (codice === "EAUTH" || [530, 534, 535].includes(risposta)) return "configurazione";
  if (codice === "EENVELOPE" || risposta >= 500) return "permanente";
  return "temporaneo";
}

const RITARDI_MINUTI = [1, 5, 30, 120] as const;

/** Numero massimo di invii per notifica: il primo più un tentativo per ogni ritardo. */
export const MAX_TENTATIVI = RITARDI_MINUTI.length + 1;

/**
 * Minuti da attendere dopo l'invio fallito numero `tentativiFatti + 1`; `null` quando i
 * tentativi sono finiti e la mail va segnata come fallita.
 */
export function ritardoRiprova(tentativiFatti: number): number | null {
  return RITARDI_MINUTI[tentativiFatti] ?? null;
}

/** Quante mail si possono ancora spedire rispetto al tetto delle ultime 24 ore. */
export function invioConsentiti(limiteGiorno: number, inviate24h: number, lotto: number): number {
  return Math.max(0, Math.min(lotto, limiteGiorno - inviate24h));
}

/** Descrizione breve dell'errore, senza indirizzi né testi delle mail: va nei log. */
export function descriviErrore(errore: unknown): string {
  const e = (typeof errore === "object" && errore !== null ? errore : {}) as ErroreSmtp;
  const parti = [
    typeof e.code === "string" ? e.code : "",
    typeof e.responseCode === "number" ? String(e.responseCode) : "",
  ].filter(Boolean);
  return parti.length > 0 ? parti.join(" ") : "errore sconosciuto";
}

// --- Composizione della mail ------------------------------------------------------------------

export function escapeHtml(testo: string): string {
  return testo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Oggetto su una riga sola (niente a-capo nelle intestazioni), con un limite di lunghezza. */
export function pulisciOggetto(titolo: string): string {
  const pulito = titolo
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (pulito || "Notifica CrAPP").slice(0, 200);
}

/** Link da aprire dalla mail: la scheda dell'evento se c'è, altrimenti la home dell'app. */
export function linkNotifica(appUrl: string, idEvento: string | null): string {
  const base = appUrl.replace(/\/+$/, "");
  return idEvento ? `${base}/evento/${encodeURIComponent(idEvento)}` : base;
}

/** Message-ID deterministico: lo stesso invio ripetuto porta lo stesso identificativo. */
export function messageId(idNotifica: string, dominio: string): string {
  return `<${idNotifica}@${dominio}>`;
}

const AVVISO_DISATTIVAZIONE = "Non vuoi più ricevere queste email? Profilo → Opzioni → Email.";

export function componiMail(
  n: NotificaEmail,
  opzioni: { appUrl: string; dominioMessageId: string },
): MailComposta {
  const link = linkNotifica(opzioni.appUrl, n.id_evento);
  const subject = pulisciOggetto(n.oggetto);
  const testo = [n.testo.trim(), `Apri CrAPP: ${link}`, AVVISO_DISATTIVAZIONE]
    .filter(Boolean)
    .join("\n\n");
  const corpoHtml = n.testo.trim()
    ? `<p style="margin:0 0 16px">${escapeHtml(n.testo.trim()).replace(/\n/g, "<br>")}</p>`
    : "";
  const html = [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px">`,
    `<h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(subject)}</h2>`,
    corpoHtml,
    `<p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#111;color:#fff;text-decoration:none">Apri CrAPP</a></p>`,
    `<p style="margin:0;font-size:12px;color:#666">${escapeHtml(AVVISO_DISATTIVAZIONE)}</p>`,
    `</div>`,
  ].join("");
  return {
    to: n.destinatario,
    subject,
    text: testo,
    html,
    messageId: messageId(n.id_notifica, opzioni.dominioMessageId),
  };
}

// --- Salute del container ---------------------------------------------------------------------

/** Il worker è sano se l'ultimo ciclo riuscito non è più vecchio di `maxMs`. */
export function staSano(ultimoCicloOk: number | null, adesso: number, maxMs: number): boolean {
  return ultimoCicloOk !== null && adesso - ultimoCicloOk <= maxMs;
}

// --- Ciclo di invio ---------------------------------------------------------------------------

export type Dipendenze = {
  prendi: (max: number) => Promise<NotificaEmail[]>;
  segna: (id: string, esito: EsitoInvio, errore?: string, prossimo?: Date) => Promise<void>;
  invia: (mail: MailComposta) => Promise<void>;
  inviateUltime24h: () => Promise<number>;
  adesso: () => Date;
  log: (messaggio: string) => void;
};

export type OpzioniCiclo = {
  limiteGiorno: number;
  lotto: number;
  appUrl: string;
  dominioMessageId: string;
};

export type RisultatoCiclo = {
  inviate: number;
  riprovate: number;
  fallite: number;
  differite: number;
  /** Perché il ciclo si è interrotto prima di finire il lotto, se è successo. */
  fermato: "limite" | "configurazione" | null;
};

const ATTESA_LIMITE_MINUTI = 60;
const ATTESA_CONFIGURAZIONE_MINUTI = 15;

const dopoMinuti = (adesso: Date, minuti: number) => new Date(adesso.getTime() + minuti * 60_000);

/**
 * Un giro: prende fino a un lotto di mail entro il tetto giornaliero e le spedisce una a una.
 * I log riportano solo id, tipo ed esito: mai indirizzi né testi.
 */
export async function elaboraCiclo(d: Dipendenze, o: OpzioniCiclo): Promise<RisultatoCiclo> {
  const risultato: RisultatoCiclo = {
    inviate: 0,
    riprovate: 0,
    fallite: 0,
    differite: 0,
    fermato: null,
  };

  const consentite = invioConsentiti(o.limiteGiorno, await d.inviateUltime24h(), o.lotto);
  if (consentite === 0) {
    risultato.fermato = "limite";
    return risultato;
  }

  const lotto = await d.prendi(consentite);
  for (const [indice, notifica] of lotto.entries()) {
    const mail = componiMail(notifica, o);
    // Solo `invia` sta nel try: se fallisse la registrazione dell'esito non è un errore SMTP e
    // non deve far ripartire una mail già consegnata (la riga resta 'in_invio' e viene
    // recuperata dalla funzione SQL dopo 10 minuti: al peggio un doppione, mai una perdita).
    let errore: unknown;
    let consegnata = false;
    try {
      await d.invia(mail);
      consegnata = true;
    } catch (e) {
      errore = e;
    }

    if (consegnata) {
      await d.segna(notifica.id_notifica, "inviata");
      risultato.inviate += 1;
      d.log(`inviata ${notifica.id_notifica} (${notifica.tipo_notifica})`);
      continue;
    }

    const tipo = classificaErroreSmtp(errore);
    const motivo = descriviErrore(errore);

    if (tipo === "limite" || tipo === "configurazione") {
      // Non è colpa della mail: si rimanda questa e tutte le successive del lotto senza
      // consumare tentativi, e il ciclo si ferma.
      const prossimo = dopoMinuti(
        d.adesso(),
        tipo === "limite" ? ATTESA_LIMITE_MINUTI : ATTESA_CONFIGURAZIONE_MINUTI,
      );
      for (const restante of lotto.slice(indice)) {
        await d.segna(restante.id_notifica, "differita", motivo, prossimo);
        risultato.differite += 1;
      }
      risultato.fermato = tipo;
      d.log(`ciclo fermato (${tipo}, ${motivo}): ${risultato.differite} mail rimandate`);
      return risultato;
    }

    const ritardo = tipo === "temporaneo" ? ritardoRiprova(notifica.tentativi_fatti) : null;
    if (ritardo === null) {
      await d.segna(notifica.id_notifica, "fallita", motivo);
      risultato.fallite += 1;
      d.log(`fallita ${notifica.id_notifica} (${notifica.tipo_notifica}, ${tipo}, ${motivo})`);
    } else {
      await d.segna(notifica.id_notifica, "riprova", motivo, dopoMinuti(d.adesso(), ritardo));
      risultato.riprovate += 1;
      d.log(`da riprovare ${notifica.id_notifica} tra ${ritardo} min (${motivo})`);
    }
  }
  return risultato;
}

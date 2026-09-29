// Worker delle notifiche email (M22, DD-036): legge la coda su Supabase e invia via SMTP.
// Solo chiamate in uscita, nessuna porta da aprire. Uso: bun mailer/mailer.mjs
// La logica sta in mailer-core.ts; qui c'è solo la colla con rete e SMTP.
import nodemailer from "nodemailer";
import { writeFile } from "node:fs/promises";
import { elaboraCiclo, leggiConfig } from "./mailer-core.ts";

const FILE_SALUTE = process.env.MAILER_FILE_SALUTE ?? "/tmp/mailer-ok";

const lettura = leggiConfig(process.env);
if ("errori" in lettura) {
  console.error(`Configurazione non valida:\n- ${lettura.errori.join("\n- ")}`);
  process.exit(1);
}
const { config } = lettura;

const log = (messaggio) => console.log(`${new Date().toISOString()} ${messaggio}`);

async function rpc(nome, corpo) {
  const risposta = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(15_000),
  });
  if (!risposta.ok) throw new Error(`rpc ${nome}: HTTP ${risposta.status}`);
  const testo = await risposta.text();
  return testo ? JSON.parse(testo) : null;
}

const trasporto = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  ...(config.smtp.auth ? { auth: config.smtp.auth } : {}),
});

const dominioMessageId = config.from.split("@")[1] ?? "crapp.local";

const dipendenze = {
  prendi: (max) => rpc("prendi_notifiche_email", { p_max: max }),
  segna: (id, esito, errore, prossimo) =>
    rpc("esito_notifica_email", {
      p_id: id,
      p_esito: esito,
      p_errore: errore ?? null,
      p_prossimo: prossimo ? prossimo.toISOString() : null,
    }),
  invia: (mail) =>
    trasporto.sendMail({
      from: { name: config.fromName, address: config.from },
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      messageId: mail.messageId,
    }),
  inviateUltime24h: () => rpc("email_inviate_ultime_24h", {}),
  adesso: () => new Date(),
  log,
};

const opzioni = {
  limiteGiorno: config.limiteGiorno,
  lotto: config.lotto,
  appUrl: config.appUrl,
  dominioMessageId,
};

let fermo = false;
for (const segnale of ["SIGTERM", "SIGINT"]) process.on(segnale, () => (fermo = true));
const attendi = (ms) => new Promise((ok) => setTimeout(ok, ms));

log(`avviato: SMTP ${config.smtp.host}:${config.smtp.port}, ogni ${config.pollSecondi}s`);
trasporto.verify().then(
  () => log("SMTP raggiungibile e credenziali accettate"),
  (errore) => log(`SMTP non verificato (${errore?.code ?? "errore"}): controlla SMTP_* nel .env`),
);

while (!fermo) {
  try {
    const esito = await elaboraCiclo(dipendenze, opzioni);
    // Un ciclo fermato dalle credenziali SMTP non segna il container come sano: dopo qualche
    // minuto `docker ps` lo mostra "unhealthy" invece di lasciar credere che tutto funzioni.
    if (esito.fermato !== "configurazione") await writeFile(FILE_SALUTE, String(Date.now()));
  } catch (errore) {
    console.error(`${new Date().toISOString()} ciclo fallito: ${errore?.message ?? errore}`);
  }
  await attendi(config.pollSecondi * 1000);
}
log("arrestato");

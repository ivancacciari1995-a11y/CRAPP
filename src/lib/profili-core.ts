import { rigaCsv } from "./scout-export";
import { inRosa, nomeCompleto, type GiocatoreSquadra } from "./giocatori-squadra";

/**
 * Profilo amministrativo di un giocatore (DD-016). I file veri stanno nel bucket privato
 * `profili-giocatore`: qui viaggiano solo i path.
 */
export type Profilo = {
  giocatoreId: string;
  dataNascita: string | null;
  luogoNascita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  email: string | null;
  documentoTipo: string | null;
  documentoNumero: string | null;
  documentoRilasciatoDa: string | null;
  documentoEmissione: string | null;
  documentoScadenza: string | null;
  documentoFrontePath: string | null;
  documentoRetroPath: string | null;
  certificatoScadenza: string | null;
  certificatoPath: string | null;
};

export type RigaProfilo = {
  giocatore_id: string;
  data_nascita: string | null;
  luogo_nascita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  email: string | null;
  documento_tipo: string | null;
  documento_numero: string | null;
  documento_rilasciato_da: string | null;
  documento_emissione: string | null;
  documento_scadenza: string | null;
  documento_fronte_path: string | null;
  documento_retro_path: string | null;
  certificato_scadenza: string | null;
  certificato_path: string | null;
};

export const COLONNE_PROFILO =
  "giocatore_id, data_nascita, luogo_nascita, indirizzo, telefono, email, documento_tipo, documento_numero, documento_rilasciato_da, documento_emissione, documento_scadenza, documento_fronte_path, documento_retro_path, certificato_scadenza, certificato_path";

export function profiloVuoto(giocatoreId: string): Profilo {
  return {
    giocatoreId,
    dataNascita: null,
    luogoNascita: null,
    indirizzo: null,
    telefono: null,
    email: null,
    documentoTipo: null,
    documentoNumero: null,
    documentoRilasciatoDa: null,
    documentoEmissione: null,
    documentoScadenza: null,
    documentoFrontePath: null,
    documentoRetroPath: null,
    certificatoScadenza: null,
    certificatoPath: null,
  };
}

export function daRigaProfilo(r: RigaProfilo): Profilo {
  return {
    giocatoreId: r.giocatore_id,
    dataNascita: r.data_nascita,
    luogoNascita: r.luogo_nascita,
    indirizzo: r.indirizzo,
    telefono: r.telefono,
    email: r.email,
    documentoTipo: r.documento_tipo,
    documentoNumero: r.documento_numero,
    documentoRilasciatoDa: r.documento_rilasciato_da,
    documentoEmissione: r.documento_emissione,
    documentoScadenza: r.documento_scadenza,
    documentoFrontePath: r.documento_fronte_path,
    documentoRetroPath: r.documento_retro_path,
    certificatoScadenza: r.certificato_scadenza,
    certificatoPath: r.certificato_path,
  };
}

/** I campi vuoti tornano al database come NULL, non come stringa vuota. */
function oNull(valore: string | null): string | null {
  const pulito = valore?.trim();
  return pulito ? pulito : null;
}

export function aRigaProfilo(p: Profilo): RigaProfilo {
  return {
    giocatore_id: p.giocatoreId,
    data_nascita: oNull(p.dataNascita),
    luogo_nascita: oNull(p.luogoNascita),
    indirizzo: oNull(p.indirizzo),
    telefono: oNull(p.telefono),
    email: oNull(p.email),
    documento_tipo: oNull(p.documentoTipo),
    documento_numero: oNull(p.documentoNumero),
    documento_rilasciato_da: oNull(p.documentoRilasciatoDa),
    documento_emissione: oNull(p.documentoEmissione),
    documento_scadenza: oNull(p.documentoScadenza),
    documento_fronte_path: oNull(p.documentoFrontePath),
    documento_retro_path: oNull(p.documentoRetroPath),
    certificato_scadenza: oNull(p.certificatoScadenza),
    certificato_path: oNull(p.certificatoPath),
  };
}

/** Pesi delle sezioni del profilo (docs/modules/profilo-giocatore.md). */
export const PESI = { dati: 34, documento: 33, certificato: 33 } as const;

export type Sezione = keyof typeof PESI;

export function sezioniComplete(p: Profilo | null | undefined): Record<Sezione, boolean> {
  return {
    dati: !!(p?.dataNascita && p.luogoNascita && p.indirizzo && p.telefono && p.email),
    documento: !!(
      p?.documentoTipo &&
      p.documentoNumero &&
      p.documentoScadenza &&
      p.documentoFrontePath &&
      p.documentoRetroPath
    ),
    certificato: !!(p?.certificatoScadenza && p.certificatoPath),
  };
}

/** Percentuale di completamento: calcolata a runtime, mai persistita (DD-007, DD-016). */
export function completamento(p: Profilo | null | undefined): number {
  const complete = sezioniComplete(p);
  return (Object.keys(PESI) as Sezione[]).reduce(
    (somma, s) => somma + (complete[s] ? PESI[s] : 0),
    0,
  );
}

/**
 * L'allenatore compila solo i dati personali ridotti (DD-034): niente indirizzo, documento
 * né certificato, che servono al tesseramento dei giocatori.
 */
export const CAMPI_ALLENATORE = ["dataNascita", "luogoNascita", "telefono", "email"] as const;

/** Percentuale dei campi dell'allenatore compilati: 100 quando ci sono tutti. */
export function completamentoAllenatore(p: Profilo | null | undefined): number {
  const pieni = CAMPI_ALLENATORE.filter((c) => !!p?.[c]?.trim()).length;
  return Math.round((pieni / CAMPI_ALLENATORE.length) * 100);
}

export type StatoScadenza = "mancante" | "scaduto" | "valido";

/** Un certificato scaduto blocca il tesseramento: per l'admin non vale come presente. */
export function statoScadenza(
  scadenza: string | null | undefined,
  path: string | null | undefined,
  oggi: string,
): StatoScadenza {
  if (!path || !scadenza) return "mancante";
  return scadenza < oggi ? "scaduto" : "valido";
}

/** Colonne richieste dal tesseramento CSI, nell'ordine del documento di modulo. */
const INTESTAZIONI = [
  "Nome",
  "Cognome",
  "Data di nascita",
  "Luogo di nascita",
  "Indirizzo",
  "Telefono",
  "Email",
  "Tipo documento",
  "Numero documento",
  "Rilasciato da",
  "Data emissione",
  "Data scadenza",
];

export function csvTesseramento(
  squadra: GiocatoreSquadra[],
  profili: Record<string, Profilo>,
): string {
  const righe = [rigaCsv(INTESTAZIONI)];
  for (const g of squadra) {
    const p = profili[g.id];
    righe.push(
      rigaCsv([
        g.nome,
        g.cognome,
        p?.dataNascita ?? "",
        p?.luogoNascita ?? "",
        p?.indirizzo ?? "",
        p?.telefono ?? "",
        p?.email ?? "",
        p?.documentoTipo ?? "",
        p?.documentoNumero ?? "",
        p?.documentoRilasciatoDa ?? "",
        p?.documentoEmissione ?? "",
        p?.documentoScadenza ?? "",
      ]),
    );
  }
  return righe.join("\n");
}

/** Etichetta per l'elenco della dashboard. */
export function etichettaGiocatore(g: GiocatoreSquadra): string {
  return `#${g.numero} ${nomeCompleto(g)}`;
}

/** Soglia dell'avviso certificati dello staff in Home (DD-035). */
export const GIORNI_AVVISO_CERTIFICATO = 7;

/** Soglia dell'avviso personale: il giocatore è avvisato un mese prima dello staff (DD-041). */
export const GIORNI_AVVISO_CERTIFICATO_GIOCATORE = 30;

/** Giorni di calendario tra due date `AAAA-MM-GG` (ora locale): negativo se `scadenza` è passata. */
export function giorniAllaScadenza(scadenza: string, oggi: string): number {
  const a = new Date(`${scadenza}T00:00:00`);
  const b = new Date(`${oggi}T00:00:00`);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** Data in formato `GG/MM/AAAA`, per i testi dell'avviso certificati. */
export function formatDataBreve(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Riga dell'avviso certificati per un giocatore (DD-035). */
export function testoScadenza(giorni: number): string {
  if (giorni === 0) return "scade oggi";
  if (giorni === 1) return "scade domani";
  return `scade tra ${giorni} giorni`;
}

export type AvvisoCertificato = {
  giocatoreId: string;
  nome: string;
  cognome: string;
  scadenza: string;
  giorni: number;
};

/** Giocatore in rosa senza certificato caricato (DD-046). */
export type CertificatoMancante = Pick<AvvisoCertificato, "giocatoreId" | "nome" | "cognome">;

function confrontaAvvisi(a: AvvisoCertificato, b: AvvisoCertificato): number {
  return a.giorni - b.giorni || a.cognome.localeCompare(b.cognome) || a.nome.localeCompare(b.nome);
}

/**
 * Certificati in scadenza o scaduti nella rosa (DD-035): calcolato al volo da
 * `certificato_scadenza`, niente stato salvato. Esclude chi non è in rosa. Chi non ha
 * ancora un certificato caricato non ha una scadenza: finisce in `mancanti` (DD-046).
 * `soglia` sono i giorni di preavviso: 7 per lo staff, 30 per il giocatore (DD-041).
 */
export function avvisiCertificati(
  rosa: GiocatoreSquadra[],
  profili: Record<string, Profilo>,
  oggi: string,
  soglia: number = GIORNI_AVVISO_CERTIFICATO,
): {
  scaduti: AvvisoCertificato[];
  inScadenza: AvvisoCertificato[];
  mancanti: CertificatoMancante[];
} {
  const scaduti: AvvisoCertificato[] = [];
  const inScadenza: AvvisoCertificato[] = [];
  const mancanti: CertificatoMancante[] = [];
  for (const g of rosa) {
    if (!inRosa(g)) continue;
    const p = profili[g.id];
    if (!p?.certificatoScadenza || !p.certificatoPath) {
      mancanti.push({ giocatoreId: g.id, nome: g.nome, cognome: g.cognome });
      continue;
    }
    const giorni = giorniAllaScadenza(p.certificatoScadenza, oggi);
    if (giorni > soglia) continue;
    const avviso: AvvisoCertificato = {
      giocatoreId: g.id,
      nome: g.nome,
      cognome: g.cognome,
      scadenza: p.certificatoScadenza,
      giorni,
    };
    (giorni < 0 ? scaduti : inScadenza).push(avviso);
  }
  scaduti.sort(confrontaAvvisi);
  inScadenza.sort(confrontaAvvisi);
  mancanti.sort((a, b) => a.cognome.localeCompare(b.cognome) || a.nome.localeCompare(b.nome));
  return { scaduti, inScadenza, mancanti };
}

/**
 * Avvisi certificati per chi guarda la Home (DD-035, DD-041): `personale` è il proprio
 * certificato (soglia 30 giorni), per chiunque sia un giocatore in rosa, e `personaleMancante`
 * dice che non l'ha ancora caricato (DD-046); `staff` sono gli altri della rosa (soglia 7
 * giorni), solo per l'admin, senza il suo nome perché già nel personale.
 */
export function avvisiCertificatiUtente(
  rosa: GiocatoreSquadra[],
  profili: Record<string, Profilo>,
  oggi: string,
  utente: { admin: boolean; base: GiocatoreSquadra | null },
): {
  personale: AvvisoCertificato | undefined;
  personaleMancante: boolean;
  staff: ReturnType<typeof avvisiCertificati> | null;
} {
  const mio = utente.base
    ? avvisiCertificati([utente.base], profili, oggi, GIORNI_AVVISO_CERTIFICATO_GIOCATORE)
    : null;
  const personale = mio ? (mio.scaduti[0] ?? mio.inScadenza[0]) : undefined;
  const staff = utente.admin
    ? avvisiCertificati(
        rosa.filter((g) => g.id !== utente.base?.id),
        profili,
        oggi,
      )
    : null;
  return { personale, personaleMancante: !!mio && mio.mancanti.length > 0, staff };
}

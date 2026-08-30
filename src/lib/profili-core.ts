import { rigaCsv } from "./scout-export";
import { nomeCompleto, type GiocatoreSquadra } from "./giocatori-squadra";

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
  fotoPath: string | null;
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
  foto_path: string | null;
};

export const COLONNE_PROFILO =
  "giocatore_id, data_nascita, luogo_nascita, indirizzo, telefono, email, documento_tipo, documento_numero, documento_rilasciato_da, documento_emissione, documento_scadenza, documento_fronte_path, documento_retro_path, certificato_scadenza, certificato_path, foto_path";

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
    fotoPath: null,
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
    fotoPath: r.foto_path,
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
    foto_path: oNull(p.fotoPath),
  };
}

/** Pesi delle sezioni del profilo (docs/modules/profilo-giocatore.md). */
export const PESI = { dati: 30, documento: 30, certificato: 30, foto: 10 } as const;

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
    foto: !!p?.fotoPath,
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

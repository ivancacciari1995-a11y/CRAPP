import type { RigaClassifica } from "./crapp-data";

/**
 * Lettura dei dati ufficiali dal portale Livescore CSI Bologna.
 * Non esiste un'API documentata: usiamo gli stessi endpoint che il sito chiama
 * via ajax. Nessuna autenticazione, ma nessuna garanzia di stabilità: ogni
 * funzione qui deve fallire in modo pulito (array vuoto), mai lanciare.
 */

export const CSI_BASE = "https://livescore.csibologna.it";
/** Campionato Open Misto Eccellenza 2025/26. Cambia a ogni stagione. */
export const CSI_PROJECT_ID = 767;
/**
 * Coppa CSI Misto Silver 2025/26. Stesso formato di tabella del campionato (girone
 * all'italiana), solo con meno squadre: `parseClassifica()` funziona invariata. Cambia a
 * ogni stagione come CSI_PROJECT_ID, vedi docs/modules/collegamento-csi.md.
 */
export const CSI_COPPA_PROJECT_ID = 848;
/** C.R.A.P. Volley sul portale CSI. */
export const CSI_TEAM_ID = 3359;
export const CSI_GIRONE = "Girone B";
export const CSI_NOME_SQUADRA = "C.R.A.P. Volley";

export const urlClassifica = (projectId = CSI_PROJECT_ID) =>
  `${CSI_BASE}/components/project-sheets.php?project_id=${projectId}`;
export const urlPartite = (teamId = CSI_TEAM_ID) =>
  `${CSI_BASE}/assets/json/getEventsByTeamId.php?team_id=${teamId}`;
/** Info generali della gara (giornata, pubblico ammesso). */
export const urlPartitaInfo = (matchId: string) =>
  `${CSI_BASE}/components/match-main.php?match_id=${matchId}`;
/** Formazioni titolari/panchina/staff di entrambe le squadre. */
export const urlPartitaFormazioni = (matchId: string) =>
  `${CSI_BASE}/components/match-players.php?match_id=${matchId}`;
/** Storico scontri diretti e probabilità di vittoria calcolata dal CSI. */
export const urlPartitaPrecedenti = (matchId: string) =>
  `${CSI_BASE}/components/match-stats.php?match_id=${matchId}`;

export type PartitaCsi = {
  id: string;
  data: string;
  ora: string;
  avversario: string;
  /** URL del logo avversario sul portale CSI, vuoto se non presente. */
  logoAvversario: string;
  casa: boolean;
  /** null finché la gara non è stata giocata. */
  setNostri: number | null;
  setLoro: number | null;
  parziali: Array<[number, number]>;
  campo: string;
  competizione: string;
  /** Es. "Girone B". */
  girone: string;
  /** Es. "5/XEB". */
  numeroGara: string;
  arbitro: string;
  /** Referto ufficiale su livescore.csibologna.it. */
  link: string;
};

export type GiocatoreFormazione = { numero: string; nome: string; ruolo: string };
export type StaffFormazione = { nome: string; ruolo: string };
export type FormazioneSquadra = {
  squadra: string;
  titolari: GiocatoreFormazione[];
  panchina: GiocatoreFormazione[];
  staff: StaffFormazione[];
};

export type PrecedentiCsi = {
  totale: number;
  vinteNoi: number;
  vinteAvversario: number;
  casaNoi: number;
  casaAvversario: number;
  fuoriNoi: number;
  fuoriAvversario: number;
  /** Percentuale 0-100, null se il CSI non la pubblica (es. sport senza storico). */
  probabilitaNoi: number | null;
  probabilitaAvversario: number | null;
};

export type DettaglioPartitaCsi = {
  /** Es. "2ª Giornata", vuoto se non trovata (fase a eliminazione, coppa...). */
  giornata: string;
  /**
   * Testo libero del CSI sotto l'impianto: a volte "Pubblico non ammesso", a volte il nome
   * della palestra o altro — non ha un formato fisso, va mostrato così com'è. Vuoto se assente.
   */
  nota: string;
  /** null se il referto non ha ancora le formazioni (partita non ancora giocata/schierata). */
  formazioni: { noi: FormazioneSquadra; avversario: FormazioneSquadra } | null;
  /** null solo se il formato non è riconosciuto; con 0 precedenti i campi restano a 0. */
  precedenti: PrecedentiCsi | null;
};

export type DatiCsi = {
  classifica: RigaClassifica[];
  /** Classifica del girone di Coppa (project_id 848). Vuota se il parsing fallisce. */
  classificaCoppa: RigaClassifica[];
  partite: PartitaCsi[];
  girone: string;
  aggiornato: string;
  /** true se il formato delle partite sembra cambiato (vedi `partiteFormatoSospetto`). */
  formatoSospetto: boolean;
};

/** "C.R.A.P. Volley" e "CRAP Volley" devono confrontarsi uguali. */
function normalizza(nome: string): string {
  return nome.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isNostraSquadra(nome: string): boolean {
  return normalizza(nome) === normalizza(CSI_NOME_SQUADRA);
}

const entita: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  nbsp: " ",
  deg: "°",
  apos: "'",
};

function testo(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (intero, codice: string) =>
      codice.startsWith("#")
        ? String.fromCharCode(Number(codice.slice(1)))
        : (entita[codice.toLowerCase()] ?? intero),
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Estrae la classifica dal frammento HTML di `project-sheets.php`.
 * Il campionato ha due gironi: prendiamo la tabella che contiene la nostra
 * squadra. Colonne (indice del `<td>`): 0 Pos · 1 Squadra · 2 Punti ·
 * 3 Giocate · 4 Vinte · 5 Perse · 8 Set fatti · 9 Set subiti.
 */
export function parseClassifica(html: string): RigaClassifica[] {
  const tabelle = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  const nostra = tabelle.find((t) => normalizza(testo(t)).includes(normalizza(CSI_NOME_SQUADRA)));
  if (!nostra) return [];

  const righe: RigaClassifica[] = [];
  for (const riga of nostra.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const celle = (riga.match(/<td[\s\S]*?<\/td>/gi) ?? []).map(testo);
    if (celle.length < 10) continue;
    const pos = Number(celle[0]);
    if (!Number.isFinite(pos) || pos === 0 || !celle[1]) continue;
    righe.push({
      pos,
      squadra: celle[1],
      punti: Number(celle[2]) || 0,
      giocate: Number(celle[3]) || 0,
      vinte: Number(celle[4]) || 0,
      perse: Number(celle[5]) || 0,
      setFatti: Number(celle[8]) || 0,
      setSubiti: Number(celle[9]) || 0,
    });
  }
  return righe;
}

type EventoCsi = {
  id?: number | string;
  start?: string;
  team1?: string;
  team1_logo?: string;
  team2?: string;
  team2_logo?: string;
  result?: string;
  partials?: string;
  field?: string;
  project?: string;
  group?: string;
  match_number?: string;
  referees?: string;
  link?: string;
};

function punteggio(result: string | undefined): [number, number] | null {
  const m = /(\d+)\s*-\s*(\d+)/.exec(result ?? "");
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function parziali(partials: string | undefined): Array<[number, number]> {
  return [...(partials ?? "").matchAll(/(\d+)\s*-\s*(\d+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
}

/** Converte gli eventi di `getEventsByTeamId.php` nel formato usato dall'app. */
export function partiteDaEventi(eventi: unknown): PartitaCsi[] {
  if (!Array.isArray(eventi)) return [];
  const partite: PartitaCsi[] = [];
  for (const evento of eventi as EventoCsi[]) {
    const team1 = testo(evento.team1 ?? "");
    const team2 = testo(evento.team2 ?? "");
    const casa = isNostraSquadra(team1);
    if (!casa && !isNostraSquadra(team2)) continue;

    const [dataIso, oraIso] = (evento.start ?? "").split("T");
    if (!dataIso) continue;

    const set = punteggio(evento.result);
    const tutti = parziali(evento.partials);
    partite.push({
      id: String(evento.id ?? `${dataIso}-${team1}-${team2}`),
      data: dataIso,
      ora: (oraIso ?? "").slice(0, 5),
      avversario: casa ? team2 : team1,
      logoAvversario: (casa ? evento.team2_logo : evento.team1_logo)?.trim() ?? "",
      casa,
      setNostri: set ? (casa ? set[0] : set[1]) : null,
      setLoro: set ? (casa ? set[1] : set[0]) : null,
      parziali: casa ? tutti : tutti.map(([a, b]) => [b, a] as [number, number]),
      campo: testo(evento.field ?? ""),
      competizione: testo(evento.project ?? ""),
      girone: testo(evento.group ?? ""),
      numeroGara: testo(evento.match_number ?? ""),
      arbitro: testo(evento.referees ?? ""),
      link: evento.link?.trim() ?? "",
    });
  }
  return partite.sort((a, b) => b.data.localeCompare(a.data));
}

/** Solo le gare già giocate, dalla più recente. */
export function partiteGiocate(partite: PartitaCsi[]): PartitaCsi[] {
  return partite.filter((p) => p.setNostri !== null && p.setLoro !== null);
}

/**
 * True se il formato di `getEventsByTeamId.php` sembra cambiato: `partiteDaEventi()` fallisce
 * in modo silenzioso (nessun array o campi non riconosciuti), quindi un array vuoto da solo non
 * distingue "il portale CSI ha cambiato formato" da "la squadra non ha ancora gare in
 * programma". Qui invece si confronta con la risposta grezza: se contiene eventi ma nessuno è
 * stato riconosciuto come nostra partita, è quasi certamente un problema di parsing, non una
 * stagione senza gare. Usata da `/api/public/csi` per loggare il caso invece di lasciarlo
 * silenzioso — vedi "Limiti noti" in docs/modules/collegamento-csi.md.
 */
export function partiteFormatoSospetto(eventiGrezzi: unknown, partite: PartitaCsi[]): boolean {
  if (!Array.isArray(eventiGrezzi)) return true;
  return eventiGrezzi.length > 0 && partite.length === 0;
}

/** Converte una gara CSI già giocata nella forma comune usata nelle liste risultati. */
export function matchDaPartitaCsi(p: PartitaCsi) {
  return {
    id: p.id,
    data: p.data,
    avversario: p.avversario,
    logoAvversario: p.logoAvversario,
    casa: p.casa,
    setNostri: p.setNostri ?? 0,
    setLoro: p.setLoro ?? 0,
    parziali: p.parziali,
    campo: p.campo,
    girone: p.girone,
    numeroGara: p.numeroGara,
    arbitro: p.arbitro,
    link: p.link,
  };
}

/** Estrae giornata e nota libera (pubblico ammesso, dettagli impianto...) da `match-main.php`. */
export function parseInfoPartita(html: string): { giornata: string; nota: string } {
  const giornataM = /(\d+)\s*<sup>a<\/sup>\s*Giornata/.exec(html);
  const notaM = /<div class="text-start"><span>([^<]*)<\/span><\/div>/.exec(html);
  return {
    giornata: giornataM ? `${giornataM[1]}ª Giornata` : "",
    nota: notaM ? testo(notaM[1] ?? "") : "",
  };
}

/**
 * Una squadra dentro `match-players.php`: una `<ul class="list-group">` di `<li>`, in
 * ordine titolari → divisore "A DISPOSIZIONE" → panchina → divisore "STAFF" → staff. I
 * membri dello staff hanno la stessa struttura dei giocatori ma senza numero di maglia.
 */
function parseBloccoSquadraFormazione(blocco: string): FormazioneSquadra | null {
  const nomeM = /team_details\.php\?team_id=\d*"[^>]*>([^<]+)<\/a>/.exec(blocco);
  const squadra = nomeM ? testo(nomeM[1] ?? "") : "";
  if (!squadra) return null;

  const titolari: GiocatoreFormazione[] = [];
  const panchina: GiocatoreFormazione[] = [];
  const staff: StaffFormazione[] = [];
  let sezione: "titolari" | "panchina" | "staff" = "titolari";
  for (const voce of blocco.match(/<li class="list-group-item[\s\S]*?<\/li>/gi) ?? []) {
    if (/A DISPOSIZIONE/.test(voce)) {
      sezione = "panchina";
      continue;
    }
    if (/STAFF/.test(voce)) {
      sezione = "staff";
      continue;
    }
    const nomePersonaM = /person_details\.php\?id=\d+">([^<]+)<\/a>/.exec(voce);
    if (!nomePersonaM) continue;
    const nome = testo(nomePersonaM[1] ?? "");
    const ruoloM = /<div class="small">([^<]*)<\/div>/.exec(voce);
    const ruolo = ruoloM ? testo(ruoloM[1] ?? "") : "";
    if (sezione === "staff") {
      staff.push({ nome, ruolo });
      continue;
    }
    const numeroM = /shrink-8"[^>]*>(\d+)</.exec(voce);
    const giocatore = { numero: numeroM?.[1] ?? "", nome, ruolo };
    (sezione === "titolari" ? titolari : panchina).push(giocatore);
  }
  return { squadra, titolari, panchina, staff };
}

/**
 * Formazioni di entrambe le squadre da `match-players.php`. Il markup non distingue
 * esplicitamente casa/ospite, ma le racchiude in due blocchi separati dal commento
 * `<!-- SQUADRA OSPITE -->`; qui si riconosce la nostra tramite `isNostraSquadra()`
 * invece di assumere un ordine fisso.
 */
export function parseFormazioni(
  html: string,
): { noi: FormazioneSquadra; avversario: FormazioneSquadra } | null {
  const idx = html.indexOf("SQUADRA OSPITE");
  if (idx === -1) return null;
  const primo = parseBloccoSquadraFormazione(html.slice(0, idx));
  const secondo = parseBloccoSquadraFormazione(html.slice(idx));
  if (!primo || !secondo) return null;
  const noi = isNostraSquadra(primo.squadra)
    ? primo
    : isNostraSquadra(secondo.squadra)
      ? secondo
      : null;
  if (!noi) return null;
  return { noi, avversario: noi === primo ? secondo : primo };
}

/**
 * Storico scontri diretti e probabilità di vittoria da `match-stats.php`. Il blocco di
 * riepilogo (non la lista partita-per-partita nel modal, meno affidabile da interpretare)
 * riporta i numeri nell'ordine squadra-casa/squadra-ospite di *questa* gara: qui si
 * riconosce quale delle due siamo noi tramite `isNostraSquadra()`, come in
 * `parseFormazioni()`. Con "0 precedenti" il CSI omette del tutto le righe
 * vittorie/in-casa/fuori (restano a 0) ma la probabilità resta comunque presente.
 */
export function parsePrecedenti(html: string): PrecedentiCsi | null {
  const idxCasa = html.indexOf("Squadra casa");
  const idxOspite = html.indexOf("Squadra ospite");
  if (idxCasa === -1 || idxOspite === -1) return null;
  const nomeCasaM = /team_details\.php\?team_id=\d+"[^>]*>([^<]+)<\/a>/.exec(
    html.slice(idxCasa, idxOspite),
  );
  const nomeOspiteM = /team_details\.php\?team_id=\d+"[^>]*>([^<]+)<\/a>/.exec(
    html.slice(idxOspite),
  );
  const nomeCasa = nomeCasaM ? testo(nomeCasaM[1] ?? "") : "";
  const nomeOspite = nomeOspiteM ? testo(nomeOspiteM[1] ?? "") : "";
  const noiECasa = isNostraSquadra(nomeCasa);
  if (!noiECasa && !isNostraSquadra(nomeOspite)) return null;

  const totaleM = /Precedenti:<\/span>\s*<b><a[^>]*>(\d+)<\/a><\/b>/.exec(html);
  const vittorieM =
    /<div><b>(\d+)<\/b><\/div>\s*<div[^>]*>vittorie<\/div>\s*<div><b>(\d+)<\/b><\/div>/.exec(html);
  const inCasaM =
    /<div><b>(\d+)<\/b><\/div>\s*<div>in casa<\/div>\s*<div><b>(\d+)<\/b><\/div>/.exec(html);
  const fuoriM = /<div><b>(\d+)<\/b><\/div>\s*<div>fuori<\/div>\s*<div><b>(\d+)<\/b><\/div>/.exec(
    html,
  );
  // Le due barre "progress-bar" appaiono nell'ordine casa/ospite: il colore (verde/rosso)
  // segue chi è favorito, non la posizione, quindi qui si usa l'ordine nel markup e non la
  // classe CSS per capire quale percentuale è "nostra".
  const percentuali = [...html.matchAll(/progress-bar[\s\S]*?width:\s*([\d.]+)%/g)].map((m) =>
    Number(m[1]),
  );
  const [probCasa, probOspite] = percentuali;

  // I due gruppi di ogni regex sono nell'ordine squadra-casa/squadra-ospite di questa gara:
  // `casaIndice`/`ospiteIndice` scelgono quale dei due è "noi" in base a `noiECasa`.
  const casaIndice = noiECasa ? 1 : 2;
  const ospiteIndice = noiECasa ? 2 : 1;
  const numero = (m: RegExpExecArray | null, indice: 1 | 2) => (m ? Number(m[indice]) : 0);

  return {
    totale: totaleM ? Number(totaleM[1]) : 0,
    vinteNoi: numero(vittorieM, casaIndice),
    vinteAvversario: numero(vittorieM, ospiteIndice),
    casaNoi: numero(inCasaM, casaIndice),
    casaAvversario: numero(inCasaM, ospiteIndice),
    fuoriNoi: numero(fuoriM, casaIndice),
    fuoriAvversario: numero(fuoriM, ospiteIndice),
    probabilitaNoi: (noiECasa ? probCasa : probOspite) ?? null,
    probabilitaAvversario: (noiECasa ? probOspite : probCasa) ?? null,
  };
}

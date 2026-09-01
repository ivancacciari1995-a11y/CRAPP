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
/** C.R.A.P. Volley sul portale CSI. */
export const CSI_TEAM_ID = 3359;
export const CSI_GIRONE = "Girone B";
export const CSI_NOME_SQUADRA = "C.R.A.P. Volley";

export const urlClassifica = (projectId = CSI_PROJECT_ID) =>
  `${CSI_BASE}/components/project-sheets.php?project_id=${projectId}`;
export const urlPartite = (teamId = CSI_TEAM_ID) =>
  `${CSI_BASE}/assets/json/getEventsByTeamId.php?team_id=${teamId}`;

export type PartitaCsi = {
  id: string;
  data: string;
  ora: string;
  avversario: string;
  casa: boolean;
  /** null finché la gara non è stata giocata. */
  setNostri: number | null;
  setLoro: number | null;
  parziali: Array<[number, number]>;
  campo: string;
  competizione: string;
};

export type DatiCsi = {
  classifica: RigaClassifica[];
  partite: PartitaCsi[];
  girone: string;
  aggiornato: string;
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
  team2?: string;
  result?: string;
  partials?: string;
  field?: string;
  project?: string;
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
      casa,
      setNostri: set ? (casa ? set[0] : set[1]) : null,
      setLoro: set ? (casa ? set[1] : set[0]) : null,
      parziali: casa ? tutti : tutti.map(([a, b]) => [b, a] as [number, number]),
      campo: testo(evento.field ?? ""),
      competizione: testo(evento.project ?? ""),
    });
  }
  return partite.sort((a, b) => b.data.localeCompare(a.data));
}

/** Solo le gare già giocate, dalla più recente. */
export function partiteGiocate(partite: PartitaCsi[]): PartitaCsi[] {
  return partite.filter((p) => p.setNostri !== null && p.setLoro !== null);
}

/** Converte una gara CSI già giocata nella forma comune usata nelle liste risultati. */
export function matchDaPartitaCsi(p: PartitaCsi) {
  return {
    id: p.id,
    data: p.data,
    avversario: p.avversario,
    casa: p.casa,
    setNostri: p.setNostri ?? 0,
    setLoro: p.setLoro ?? 0,
    parziali: p.parziali,
  };
}

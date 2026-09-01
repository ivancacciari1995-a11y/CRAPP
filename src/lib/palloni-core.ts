import { formatData, giocatori } from "./crapp-data";
import type { Evento } from "./eventi";

export type Turno = { evento_id: string; giocatore_id: string; aggiornato_da: string | null };

/** Eventi che richiedono i palloni (allenamenti, partite, extra), in ordine di data. */
export function eventiPalloni(eventi: Evento[]): Evento[] {
  return eventi
    .filter((e) => e.tipo !== "compleanno")
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Completa i turni mancanti proponendo, a rotazione, chi ha portato i palloni
 * meno volte (a parità, chi non lo fa da più tempo).
 */
export function completaTurni(
  turni: Record<string, string>,
  eventi: Evento[],
): Record<string, string> {
  const risultato: Record<string, string> = { ...turni };
  const conteggio = new Map<string, number>(giocatori.map((g) => [g.id, 0]));
  const ultimo = new Map<string, number>(giocatori.map((g) => [g.id, -1]));

  eventiPalloni(eventi).forEach((evento, indice) => {
    const assegnato = risultato[evento.id];
    if (assegnato && conteggio.has(assegnato)) {
      conteggio.set(assegnato, (conteggio.get(assegnato) ?? 0) + 1);
      ultimo.set(assegnato, indice);
      return;
    }
    if (assegnato) return;

    const scelto = giocatori.slice().sort((a, b) => {
      const ca = conteggio.get(a.id) ?? 0;
      const cb = conteggio.get(b.id) ?? 0;
      if (ca !== cb) return ca - cb;
      const ua = ultimo.get(a.id) ?? -1;
      const ub = ultimo.get(b.id) ?? -1;
      if (ua !== ub) return ua - ub;
      return a.nome.localeCompare(b.nome);
    })[0];

    if (!scelto) return;
    risultato[evento.id] = scelto.id;
    conteggio.set(scelto.id, (conteggio.get(scelto.id) ?? 0) + 1);
    ultimo.set(scelto.id, indice);
  });

  return risultato;
}

/** Quante volte ciascun giocatore è incaricato dei palloni. */
export function conteggioTurni(turni: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of Object.values(turni)) out[id] = (out[id] ?? 0) + 1;
  return out;
}

export function eventiDelGiorno(eventi: Evento[], isoData: string): Evento[] {
  return eventiPalloni(eventi).filter((e) => e.data === isoData);
}

/** Evento immediatamente precedente: chi era incaricato lì deve riportare i palloni. */
export function eventoPrecedente(eventi: Evento[], eventoId: string): Evento | undefined {
  const lista = eventiPalloni(eventi);
  const i = lista.findIndex((e) => e.id === eventoId);
  return i > 0 ? lista[i - 1] : undefined;
}

export function eventoSuccessivo(eventi: Evento[], eventoId: string): Evento | undefined {
  const lista = eventiPalloni(eventi);
  const i = lista.findIndex((e) => e.id === eventoId);
  return i >= 0 ? lista[i + 1] : undefined;
}

export function oggiISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Chi deve ricevere l'avviso push, oggi: chi porta i palloni e chi li riprende. */
export function destinatariPromemoriaPalloni(
  turni: Record<string, string>,
  eventi: Evento[],
  oggi: string,
): string[] {
  const destinatari = new Set<string>();
  for (const evento of eventiDelGiorno(eventi, oggi)) {
    const incaricato = turni[evento.id];
    if (incaricato) destinatari.add(incaricato);
    const prima = eventoPrecedente(eventi, evento.id);
    const precedente = prima ? turni[prima.id] : undefined;
    if (precedente) destinatari.add(precedente);
  }
  return [...destinatari];
}

/** Testo del push per un giocatore: priorità a "riporta oggi", poi "tocca a te", poi generico. */
export function messaggioPalloniOggi(
  turni: Record<string, string>,
  eventi: Evento[],
  oggi: string,
  mioId: string,
  nome: string,
): { title: string; body: string } {
  for (const evento of eventiDelGiorno(eventi, oggi)) {
    const prima = eventoPrecedente(eventi, evento.id);
    if (prima && turni[prima.id] === mioId) {
      return {
        title: "Porta i palloni oggi",
        body: `${evento.titolo} · ${evento.ora}. I palloni li hai tu dalla volta scorsa.`,
      };
    }
    if (turni[evento.id] === mioId) {
      const dopo = eventoSuccessivo(eventi, evento.id);
      return {
        title: "Tocca a te prendere i palloni",
        body: dopo
          ? `A fine ${evento.titolo} porta a casa i palloni e riportali il ${formatData(dopo.data)}.`
          : `A fine ${evento.titolo} porta a casa i palloni.`,
      };
    }
  }

  return {
    title: "CrAPP · Turno palloni",
    body: nome ? `${nome}, controlla il turno palloni nel calendario.` : "Controlla il calendario.",
  };
}

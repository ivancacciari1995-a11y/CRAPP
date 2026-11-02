import type { Giocatore } from "./crapp-data";
import {
  azioniMeta,
  contaValutazioni,
  fondamentali,
  totaliPerGiocatore,
  type ScoutMatch,
} from "./scout-store";

/** Riga CSV con separatore ";" (Excel IT), riusata anche dall'export tesseramento. */
export function rigaCsv(campi: Array<string | number>) {
  return campi
    .map((c) => {
      const testo = String(c);
      return /[";\n]/.test(testo) ? `"${testo.replace(/"/g, '""')}"` : testo;
    })
    .join(";");
}

/** Esporta la scoutizzazione di una partita in CSV (separatore ";" per Excel IT). */
export function csvScoutMatch(match: ScoutMatch, rosa: Giocatore[]): string {
  const righe: string[] = [];
  righe.push(
    rigaCsv([
      "Partita",
      match.casa ? "CRAP Volley" : match.avversario,
      "vs",
      match.casa ? match.avversario : "CRAP Volley",
    ]),
  );
  righe.push(rigaCsv(["Data", match.data, "Set", `${match.setNostri}-${match.setLoro}`]));
  righe.push("");
  righe.push(rigaCsv(["Set", "Parziale nostro", "Parziale loro"]));
  match.parziali.forEach((p, i) => righe.push(rigaCsv([i + 1, p[0], p[1]])));
  righe.push("");
  righe.push(rigaCsv(["Numero", "Giocatore", "Ruolo", "Punti", "Ace", "Muri", "Errori"]));
  const totali = totaliPerGiocatore(match.azioni);
  for (const g of rosa) {
    const t = totali.get(g.id);
    if (!t) continue;
    righe.push(rigaCsv([g.numero, g.nome, g.ruolo, t.punti, t.ace, t.muri, t.errori]));
  }
  if (match.valutazioni.length > 0) {
    righe.push("");
    righe.push(
      rigaCsv([
        "Set",
        "Numero",
        "Giocatore",
        ...fondamentali.flatMap((f) => [`${f.label} +`, `${f.label} -`]),
      ]),
    );
    const sets = [...new Set(match.valutazioni.map((v) => v.set))].sort((x, y) => x - y);
    for (const set of sets) {
      for (const g of rosa) {
        if (!match.valutazioni.some((v) => v.set === set && v.giocatoreId === g.id)) continue;
        const c = contaValutazioni(match.valutazioni, g.id, set);
        righe.push(
          rigaCsv([
            set,
            g.numero,
            g.nome,
            ...fondamentali.flatMap((f) => [c[f.id].piu, c[f.id].meno]),
          ]),
        );
      }
    }
  }
  righe.push("");
  righe.push(rigaCsv(["Set", "Giocatore", "Azione"]));
  for (const a of match.azioni) {
    const g = rosa.find((x) => x.id === a.giocatoreId);
    righe.push(rigaCsv([a.set, g?.nome ?? "—", azioniMeta[a.tipo].label]));
  }
  return righe.join("\n");
}

export function scaricaCsv(nomeFile: string, contenuto: string) {
  const blob = new Blob([`\uFEFF${contenuto}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFile;
  a.click();
  URL.revokeObjectURL(url);
}

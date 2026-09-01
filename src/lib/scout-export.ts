import { giocatori } from "./crapp-data";
import { azioniMeta, totaliPerGiocatore, type ScoutMatch } from "./scout-store";

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
export function csvScoutMatch(match: ScoutMatch): string {
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
  for (const g of giocatori) {
    const t = totali.get(g.id);
    if (!t) continue;
    righe.push(rigaCsv([g.numero, g.nome, g.ruolo, t.punti, t.ace, t.muri, t.errori]));
  }
  righe.push("");
  righe.push(rigaCsv(["Set", "Giocatore", "Azione"]));
  for (const a of match.azioni) {
    const g = giocatori.find((x) => x.id === a.giocatoreId);
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

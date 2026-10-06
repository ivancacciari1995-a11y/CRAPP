/** Check del componente degli avvisi in Home: `bun test/unit/avviso.test.ts`. */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarClock, FileX } from "lucide-react";
import { CorpoAvviso, type TonoAvviso } from "@/components/crapp/Avviso";

const html = (p: Parameters<typeof CorpoAvviso>[0]) =>
  renderToStaticMarkup(createElement(CorpoAvviso, p));

// --- ogni tono ha il suo colore, e l'icona è decorativa (il titolo dice già tutto) ---
const classi: Record<TonoAvviso, string> = {
  critico: "bg-destructive",
  attenzione: "bg-warning",
  scaduto: "bg-primary",
  azione: "bg-accent-grad",
};
for (const [tono, classe] of Object.entries(classi) as [TonoAvviso, string][]) {
  const h = html({ tono, icona: FileX, titolo: "Titolo" });
  assert.ok(h.includes(classe), `${tono}: classe colore ${classe}`);
  assert.ok(h.includes("Titolo"), `${tono}: titolo`);
  assert.ok(h.includes('aria-hidden="true"'), `${tono}: icona nascosta ai lettori di schermo`);
}

// --- testi: un paragrafo per frase ---------------------------------------------------
const conTesti = html({
  tono: "attenzione",
  icona: CalendarClock,
  titolo: "Certificato in scadenza",
  testi: ["Prima frase.", "Seconda frase."],
});
assert.equal((conTesti.match(/<p /g) ?? []).length, 3, "titolo + due paragrafi");
assert.ok(!conTesti.includes("<ul"), "senza elenco niente lista");

// --- elenco: righe chi/cosa, conteggio solo con più di una riga ----------------------
const una = html({
  tono: "critico",
  icona: FileX,
  titolo: "Certificati mancanti",
  elenco: [{ chi: "Mario Rossi", cosa: "non caricato" }],
});
assert.ok(una.includes("Mario Rossi") && una.includes("non caricato"), "riga con chi e cosa");
assert.ok(!una.includes("persone"), "una sola riga: nessun conteggio");

const tre = html({
  tono: "critico",
  icona: FileX,
  titolo: "Certificati mancanti",
  elenco: [
    { chi: "Mario Rossi", cosa: "non caricato" },
    { chi: "Luca Bianchi", cosa: "non caricato" },
    { chi: "Anna Verdi", cosa: "non caricato" },
  ],
});
assert.equal((tre.match(/<li /g) ?? []).length, 3, "una riga per persona");
assert.ok(tre.includes('aria-label="3 persone"'), "conteggio accessibile");

// --- freccia solo se la card porta altrove -------------------------------------------
const base = { tono: "scaduto", icona: FileX, titolo: "t" } as const;
assert.ok(!html(base).includes("lucide-chevron-right"), "senza link niente freccia");
assert.ok(
  html({ ...base, cliccabile: true }).includes("lucide-chevron-right"),
  "con link la freccia",
);

// --- etichetta e riquadri (turno palloni) --------------------------------------------
const palloni = html({
  tono: "azione",
  icona: FileX,
  titolo: "Turno palloni",
  etichetta: "Oggi",
  testi: ["Porta i palloni."],
  riquadri: true,
});
assert.ok(palloni.includes("Oggi"), "etichetta mostrata");
assert.ok(palloni.includes("bg-black/15"), "il messaggio è in un riquadro");
assert.ok(palloni.includes("bg-black/25"), "etichetta in pillola");
assert.ok(!html({ ...base }).includes("bg-black/25"), "senza etichetta niente pillola");
assert.ok(
  !html({ ...base, testi: ["x"] }).includes("bg-black/15"),
  "senza riquadri testo semplice",
);

console.log("avviso: ok");

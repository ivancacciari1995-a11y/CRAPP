/**
 * Check del parsing CSI: `bun src/lib/csi-core.test.ts`.
 * Con CSI_LIVE=1 verifica anche gli endpoint reali del portale.
 */
import assert from "node:assert/strict";
import {
  CSI_COPPA_PROJECT_ID,
  isNostraSquadra,
  matchDaPartitaCsi,
  parseClassifica,
  parseFormazioni,
  parseInfoPartita,
  parsePrecedenti,
  partiteDaEventi,
  partiteFormatoSospetto,
  partiteGiocate,
  urlClassifica,
  urlPartite,
  urlPartitaFormazioni,
  urlPartitaInfo,
  urlPartitaPrecedenti,
} from "@/lib/csi-core";

const htmlClassifica = `
<table class="ranking">
  <tr><th>Pos</th><th>Squadra</th></tr>
  <tr><td>1</td><td><a href="team_details.php?team_id=1">Altra Squadra Girone A</a></td>
      <td><b>40</b></td><td>16</td><td>13</td><td>3</td><td>2</td><td>1</td><td>42</td><td>18</td><td>24</td></tr>
</table>
<table class="ranking">
  <tr><th>Pos</th><th>Squadra</th></tr>
  <tr><td>1</td><td><a href="team_details.php?team_id=9">Paolo Poggi Volley &amp; C.</a></td>
      <td><b>40</b></td><td>16</td><td>13</td><td>3</td><td>2</td><td>1</td><td>43</td><td>17</td><td>26</td></tr>
  <tr class="align-middle">
    <!-- Posizione --><td>4</td>
    <td class="d-flex"><img src="images/teams/logos/CRAP_Volley_3359.jpg" alt="">
      <a href="team_details.php?team_id=3359">C.R.A.P. Volley                    </a></td>
    <td><b>30</b></td><td>16</td><td>10</td><td>6</td><td>3</td><td>3</td><td>36</td><td>28</td><td>8</td>
    <td>1427</td><td>1329</td><td>98</td><td>0.56</td><td>1.07</td>
    <td><svg viewBox="0 0 16 16"><path d="M16 8A8"/></svg></td>
  </tr>
</table>`;

const righe = parseClassifica(htmlClassifica);
assert.equal(righe.length, 2, "prende solo il girone che contiene la nostra squadra");
assert.deepEqual(righe[1], {
  pos: 4,
  squadra: "C.R.A.P. Volley",
  punti: 30,
  giocate: 16,
  vinte: 10,
  perse: 6,
  setFatti: 36,
  setSubiti: 28,
});
assert.equal(righe[0]!.squadra, "Paolo Poggi Volley & C.", "decodifica le entità HTML");
assert.deepEqual(parseClassifica("<p>pagina cambiata</p>"), [], "portale cambiato: nessun crash");

// La Coppa ha un girone più piccolo (poche squadre) ma la stessa struttura di tabella del
// campionato: `parseClassifica()` funziona invariata, non serve un parser dedicato.
const htmlCoppa = `
<table class="ranking">
  <tr><th>Pos</th><th>Squadra</th></tr>
  <tr><td>1</td><td><a href="team_details.php?team_id=2">Set in the City</a></td>
      <td><b>7</b></td><td>3</td><td>2</td><td>1</td><td>0</td><td>0</td><td>8</td><td>4</td></tr>
  <tr><td>2</td><td><a href="team_details.php?team_id=3359">C.R.A.P. Volley</a></td>
      <td><b>6</b></td><td>3</td><td>2</td><td>1</td><td>0</td><td>0</td><td>8</td><td>5</td></tr>
</table>`;
const righeCoppa = parseClassifica(htmlCoppa);
assert.equal(righeCoppa.length, 2, "girone di Coppa più piccolo del campionato: ok comunque");
assert.equal(righeCoppa[1]!.squadra, "C.R.A.P. Volley");

assert.ok(isNostraSquadra("CRAP Volley") && isNostraSquadra("C.R.A.P. Volley "));
assert.ok(!isNostraSquadra("CRAP Volley B"));

const eventi = [
  {
    id: 1,
    start: "2025-11-12T22:00:00",
    team1: "C.R.A.P. Volley",
    team1_logo: "images/teams/logos/CRAP_Volley_3359.jpg",
    team2: "AMCM",
    team2_logo: "images/teams/logos/AMCM_1943.JPG",
    result: "3 - 1",
    partials: "25 - 23</br>23 - 25</br>25 - 18</br>25 - 22</br>",
    field: "Sabin Piccolo",
    project: "PVM - Campionato Open Misto Eccellenza",
    group: "Girone B",
    match_number: "5/XEB",
    referees: "",
    link: "https://livescore.csibologna.it/match_details.php?id=1",
  },
  {
    id: 2,
    start: "2025-11-19T22:00:00",
    team1: "Gnu Tim SdC",
    team2: "C.R.A.P. Volley",
    result: "3 - 2",
    partials: "25 - 21</br>18 - 25</br>",
    field: "BVI",
    project: "PVM - Campionato Open Misto Eccellenza",
  },
  { id: 3, start: "2026-09-10T21:00:00", team1: "C.R.A.P. Volley", team2: "Esselle", result: "" },
  { id: 4, start: "2025-10-01T21:00:00", team1: "Esselle", team2: "AMCM", result: "3 - 0" },
];

const partite = partiteDaEventi(eventi);
assert.equal(partite.length, 3, "scarta le gare di altre squadre");
assert.equal(partite[0]!.data, "2026-09-10", "ordinate dalla più recente");
assert.equal(partite[0]!.setNostri, null, "gara futura senza risultato");

const casa = partite.find((p) => p.id === "1")!;
assert.deepEqual([casa.casa, casa.avversario, casa.setNostri, casa.setLoro], [true, "AMCM", 3, 1]);
assert.deepEqual(casa.parziali[1], [23, 25]);
assert.equal(casa.ora, "22:00");
assert.equal(
  casa.logoAvversario,
  "images/teams/logos/AMCM_1943.JPG",
  "logo dell'avversario, non il nostro",
);
assert.equal(casa.girone, "Girone B");
assert.equal(casa.numeroGara, "5/XEB");
assert.equal(casa.link, "https://livescore.csibologna.it/match_details.php?id=1");

const trasferta = partite.find((p) => p.id === "2")!;
assert.deepEqual(
  [trasferta.casa, trasferta.avversario, trasferta.setNostri, trasferta.setLoro],
  [false, "Gnu Tim SdC", 2, 3],
  "in trasferta il punteggio va ribaltato",
);
assert.deepEqual(trasferta.parziali[0], [21, 25], "anche i parziali");

assert.equal(partiteGiocate(partite).length, 2);
assert.deepEqual(partiteDaEventi("non è un array"), [], "risposta inattesa: nessun crash");

// --- matchDaPartitaCsi: i campi leggeri (logo, girone, n° gara, arbitro, link) arrivano
// fino alla forma usata nelle liste risultati, non solo nel tipo interno --------------------
assert.deepEqual(matchDaPartitaCsi(casa), {
  id: "1",
  data: "2025-11-12",
  avversario: "AMCM",
  logoAvversario: "images/teams/logos/AMCM_1943.JPG",
  casa: true,
  setNostri: 3,
  setLoro: 1,
  parziali: casa.parziali,
  campo: "Sabin Piccolo",
  girone: "Girone B",
  numeroGara: "5/XEB",
  arbitro: "",
  link: "https://livescore.csibologna.it/match_details.php?id=1",
});

// --- partiteFormatoSospetto: distingue "nessuna gara ancora" da "formato rotto" -------------
assert.equal(
  partiteFormatoSospetto(eventi, partite),
  false,
  "eventi grezzi presenti e riconosciuti: nessun sospetto",
);
assert.equal(
  partiteFormatoSospetto([], []),
  false,
  "nessun evento grezzo: probabilmente solo una stagione senza gare, non un formato rotto",
);
assert.equal(
  partiteFormatoSospetto("non è un array", []),
  true,
  "la risposta non è più un array: il formato è cambiato",
);
const eventiSenzaCampiRiconosciuti = [
  { id: 1, quando: "2025-11-12", squadraCasa: "C.R.A.P. Volley", squadraOspite: "AMCM" },
];
assert.equal(
  partiteFormatoSospetto(
    eventiSenzaCampiRiconosciuti,
    partiteDaEventi(eventiSenzaCampiRiconosciuti),
  ),
  true,
  "eventi presenti ma con campi rinominati: nessuno riconosciuto, sospetto fondato",
);

// --- parseInfoPartita: giornata e nota libera da match-main.php -----------------------------
const htmlMatchMain = `
<div>
  <small><small class="d-block">2<sup>a</sup> Giornata</small></small>
  <div class="pt-3 border-top text-center">
    Impianto: <a href="field_details.php?id=400">Sabin Piccolo</a>
    <div class="text-start"><span>Pubblico non ammesso</span></div>
  </div>
</div>`;
assert.deepEqual(parseInfoPartita(htmlMatchMain), {
  giornata: "2ª Giornata",
  nota: "Pubblico non ammesso",
});
assert.deepEqual(
  parseInfoPartita("<p>pagina cambiata</p>"),
  { giornata: "", nota: "" },
  "portale cambiato: nessun crash, campi vuoti",
);

// --- parseFormazioni: titolari/panchina/staff di entrambe le squadre, noi riconosciuti
// tramite isNostraSquadra() e non un ordine fisso ------------------------------------------
const htmlFormazioni = `
<!-- SQUADRA CASA -->
<div class="col-12 col-md-6 mt-4">
  <strong><a href="team_details.php?team_id=3359">C.R.A.P. Volley</a></strong>
  <ul class="list-group mt-2">
    <li class="list-group-item">
      <span class="fa-layers-text" data-fa-transform="shrink-8">73</span>
      <strong><a href="person_details.php?id=1">Bologna Mattias</a></strong>
      <div class="small"></div>
    </li>
    <li class="list-group-item">
      <span class="fa-layers-text" data-fa-transform="shrink-8">11</span>
      <strong><a href="person_details.php?id=2">Chilese Silvia</a></strong>
      <div class="small">Libero</div>
    </li>
    <li class="list-group-item bg-light"><strong>A DISPOSIZIONE</strong></li>
    <li class="list-group-item">
      <span class="fa-layers-text" data-fa-transform="shrink-8">14</span>
      <strong><a href="person_details.php?id=3">Di Castelnuovo Carlo</a></strong>
      <div class="small"></div>
    </li>
    <li class="list-group-item bg-light"><strong>STAFF</strong></li>
    <li class="list-group-item">
      <strong><a href="person_details.php?id=4">Ricci Iacopo</a></strong>
      <div class="small">Allenatore</div>
    </li>
  </ul>
</div>
<!-- SQUADRA OSPITE -->
<div class="col-12 col-md-6 mt-4">
  <strong><a href="team_details.php?team_id=3357">AMCM</a></strong>
  <ul class="list-group mt-2">
    <li class="list-group-item">
      <span class="fa-layers-text" data-fa-transform="shrink-8">7</span>
      <strong><a href="person_details.php?id=5">Rossi Anna</a></strong>
      <div class="small"></div>
    </li>
  </ul>
</div>`;
const formazioni = parseFormazioni(htmlFormazioni)!;
assert.equal(formazioni.noi.squadra, "C.R.A.P. Volley");
assert.equal(
  formazioni.avversario.squadra,
  "AMCM",
  "riconosciuta come avversario anche da seconda posizione",
);
assert.deepEqual(formazioni.noi.titolari, [
  { numero: "73", nome: "Bologna Mattias", ruolo: "" },
  { numero: "11", nome: "Chilese Silvia", ruolo: "Libero" },
]);
assert.deepEqual(formazioni.noi.panchina, [
  { numero: "14", nome: "Di Castelnuovo Carlo", ruolo: "" },
]);
assert.deepEqual(formazioni.noi.staff, [{ nome: "Ricci Iacopo", ruolo: "Allenatore" }]);
assert.equal(formazioni.avversario.titolari.length, 1);
assert.deepEqual(parseFormazioni("<p>pagina cambiata</p>"), null, "portale cambiato: nessun crash");
assert.deepEqual(
  parseFormazioni(htmlFormazioni.replace("C.R.A.P. Volley", "Un'altra squadra")),
  null,
  "nessuna delle due è la nostra squadra: formato non riconosciuto",
);

// --- parsePrecedenti: storico scontri diretti e probabilità di vittoria da match-stats.php --
const htmlPrecedenti = `
<div class="col-12 col-md-6 my-3">Squadra casa
  <strong><a href="team_details.php?team_id=3359">C.R.A.P. Volley</a></strong>
</div>
<div class="col-12 col-md-6 my-3">Squadra ospite
  <strong><a href="team_details.php?team_id=3357">AMCM</a></strong>
</div>
<div><span class="text-muted">Precedenti:</span> <b><a href="#">5</a></b></div>
<div class="d-flex justify-content-between pt-2 px-5">
  <div><b>3</b></div>
  <div class="">vittorie</div>
  <div><b>2</b></div>
</div>
<div class="d-flex justify-content-between small text-muted px-5">
  <div><b>1</b></div>
  <div>in casa</div>
  <div><b>1</b></div>
</div>
<div class="d-flex justify-content-between small text-muted px-5">
  <div><b>2</b></div>
  <div>fuori</div>
  <div><b>1</b></div>
</div>
<div class="progress-bar bg-success" style="width: 56.97%;">56.97%</div>
<div class="progress-bar bg-danger" style="width: 43.03%;">43.03%</div>`;
assert.deepEqual(parsePrecedenti(htmlPrecedenti), {
  totale: 5,
  vinteNoi: 3,
  vinteAvversario: 2,
  casaNoi: 1,
  casaAvversario: 1,
  fuoriNoi: 2,
  fuoriAvversario: 1,
  probabilitaNoi: 56.97,
  probabilitaAvversario: 43.03,
});
// Se siamo la squadra ospite invece che casa, i numeri vanno scambiati di conseguenza.
const precedentiOspiti = parsePrecedenti(
  htmlPrecedenti
    .replace("C.R.A.P. Volley", "__TMP__")
    .replace("AMCM", "C.R.A.P. Volley")
    .replace("__TMP__", "AMCM"),
)!;
assert.deepEqual(
  [precedentiOspiti.vinteNoi, precedentiOspiti.vinteAvversario, precedentiOspiti.probabilitaNoi],
  [2, 3, 43.03],
  "noi/avversario scambiati quando siamo la squadra ospite",
);
assert.equal(parsePrecedenti("<p>pagina cambiata</p>"), null, "portale cambiato: nessun crash");

// --- URL dei nuovi endpoint per-partita ------------------------------------------------------
assert.equal(
  urlPartitaInfo("33694"),
  "https://livescore.csibologna.it/components/match-main.php?match_id=33694",
);
assert.equal(
  urlPartitaFormazioni("33694"),
  "https://livescore.csibologna.it/components/match-players.php?match_id=33694",
);
assert.equal(
  urlPartitaPrecedenti("33694"),
  "https://livescore.csibologna.it/components/match-stats.php?match_id=33694",
);

if (process.env["CSI_LIVE"]) {
  const [html, htmlCoppa, json] = await Promise.all([
    fetch(urlClassifica()).then((r) => r.text()),
    fetch(urlClassifica(CSI_COPPA_PROJECT_ID)).then((r) => r.text()),
    fetch(urlPartite()).then((r) => r.json()),
  ]);
  const live = parseClassifica(html);
  const nostra = live.find((r) => isNostraSquadra(r.squadra));
  assert.ok(nostra, "la nostra squadra è in classifica");
  assert.ok(live.length >= 8 && nostra.giocate > 0);
  const liveCoppa = parseClassifica(htmlCoppa);
  assert.ok(
    liveCoppa.some((r) => isNostraSquadra(r.squadra)),
    "la nostra squadra è nel girone di Coppa",
  );
  const livePartite = partiteDaEventi(json);
  const liveGiocate = partiteGiocate(livePartite);
  assert.ok(livePartite.length > 0 && liveGiocate.length > 0);
  assert.ok(
    liveGiocate.every((p) => p.link.startsWith("https://")),
    "ogni partita ha un referto",
  );

  const primaGiocata = liveGiocate[0]!;
  const [liveMain, livePlayers, liveStats] = await Promise.all([
    fetch(urlPartitaInfo(primaGiocata.id)).then((r) => r.text()),
    fetch(urlPartitaFormazioni(primaGiocata.id)).then((r) => r.text()),
    fetch(urlPartitaPrecedenti(primaGiocata.id)).then((r) => r.text()),
  ]);
  const liveFormazioni = parseFormazioni(livePlayers);
  assert.ok(liveFormazioni, "formazioni riconosciute per una gara già giocata");
  assert.ok(isNostraSquadra(liveFormazioni!.noi.squadra));
  const livePrecedenti = parsePrecedenti(liveStats);
  assert.ok(livePrecedenti, "precedenti riconosciuti");
  console.log(
    `live: ${live.length} squadre, ${livePartite.length} partite, noi ${nostra.pos}°, ` +
      `${parseInfoPartita(liveMain).giornata || "(senza giornata)"}, ` +
      `formazione ${liveFormazioni!.noi.titolari.length} titolari`,
  );
}

console.log("csi-core: ok");

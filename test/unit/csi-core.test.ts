/**
 * Check del parsing CSI: `bun src/lib/csi-core.test.ts`.
 * Con CSI_LIVE=1 verifica anche gli endpoint reali del portale.
 */
import assert from "node:assert/strict";
import {
  isNostraSquadra,
  parseClassifica,
  partiteDaEventi,
  partiteGiocate,
  urlClassifica,
  urlPartite,
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

assert.ok(isNostraSquadra("CRAP Volley") && isNostraSquadra("C.R.A.P. Volley "));
assert.ok(!isNostraSquadra("CRAP Volley B"));

const eventi = [
  {
    id: 1,
    start: "2025-11-12T22:00:00",
    team1: "C.R.A.P. Volley",
    team2: "AMCM",
    result: "3 - 1",
    partials: "25 - 23</br>23 - 25</br>25 - 18</br>25 - 22</br>",
    field: "Sabin Piccolo",
    project: "PVM - Campionato Open Misto Eccellenza",
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

const trasferta = partite.find((p) => p.id === "2")!;
assert.deepEqual(
  [trasferta.casa, trasferta.avversario, trasferta.setNostri, trasferta.setLoro],
  [false, "Gnu Tim SdC", 2, 3],
  "in trasferta il punteggio va ribaltato",
);
assert.deepEqual(trasferta.parziali[0], [21, 25], "anche i parziali");

assert.equal(partiteGiocate(partite).length, 2);
assert.deepEqual(partiteDaEventi("non è un array"), [], "risposta inattesa: nessun crash");

if (process.env["CSI_LIVE"]) {
  const [html, json] = await Promise.all([
    fetch(urlClassifica()).then((r) => r.text()),
    fetch(urlPartite()).then((r) => r.json()),
  ]);
  const live = parseClassifica(html);
  const nostra = live.find((r) => isNostraSquadra(r.squadra));
  assert.ok(nostra, "la nostra squadra è in classifica");
  assert.ok(live.length >= 8 && nostra.giocate > 0);
  const livePartite = partiteDaEventi(json);
  assert.ok(livePartite.length > 0 && partiteGiocate(livePartite).length > 0);
  console.log(`live: ${live.length} squadre, ${livePartite.length} partite, noi ${nostra.pos}°`);
}

console.log("csi-core: ok");

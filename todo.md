# TODO — Lag su Android (analisi Squadra + BarraSottosezioni)

Contesto: lag segnalato su Android nella pagina Squadra (`src/routes/squadra.tsx`) e nel
componente `BarraSottosezioni` (`src/components/crapp/BarraSottosezioni.tsx`). Elenco delle
cause individuate, in ordine di probabile impatto, con lo stato di applicazione.

## 1. [x] Ricalcolo di tutte le tab ad ogni render — APPLICATA

`voci` in `Squadra()` costruiva il JSX di tutte e 5 le sezioni (Rosa, Statistiche, Classifica,
Obiettivi, Badge) a ogni render, incluse quelle non visibili — inclusi i calcoli per giocatore
(`badgeGiocatore`, `badgeSegretiSbloccati`, `collezioneBadge`) e l'ordinamento della classifica.
Un semplice `setAperto` (aprire una card giocatore) rifaceva tutto questo lavoro per niente.

Fix: memoizzato il contenuto di ogni tab con `useMemo`, così il lavoro di ciascuna sezione si
rifà solo quando cambiano i suoi dati effettivi, non ad ogni render del componente.

Nessun trade-off: puro guadagno di performance, identico su Android e iOS.

## 2. [x] `backdrop-blur-md` sulla barra tab sticky — APPLICATA

`BarraSottosezioni.tsx` (variante "pillole", solo Profilo — Squadra/Campionato usano
"sottolineatura" e non avevano blur qui). Costoso da compositare su Android Chrome/WebView,
specialmente con la barra visibile durante lo scroll del pannello sottostante. Su iOS Safari il
costo è molto più basso (accelerazione via Core Animation).

Fix: `BarraSottosezioni` ora usa `useMotoRidotto` (stesso heuristic di RAM bassa /
`prefers-reduced-motion` già introdotto per `BottomNav`, punto 6) al posto del solo
`useReducedMotion`. Sui device deboli il blur sparisce (sfondo pieno `bg-background`); su iOS e
device performanti resta identico a prima.

Presente anche in `CelebrazioneBadge.tsx:33` (`backdrop-blur-sm`), non toccato: non è sticky e
compare solo alla celebrazione, impatto marginale.

## 3. [x] Gesture `drag="x"` di Framer Motion sul pannello swipeabile — APPLICATA

`BarraSottosezioni.tsx` e stesso pattern in `calendario.tsx` (swipe tra mesi). Ogni `pointermove`
passa dal thread JS invece di essere gestito nativamente; su Android più pesante da instradare,
specialmente con `touch-pan-y` + `drag="x"` insieme su contenuto lungo che scrolla in verticale.

Fix: `drag` è ora `ridotto ? false : "x"` in entrambi i file, stesso `useMotoRidotto` del punto
2. Sui device deboli lo swipe orizzontale (cambio tab / cambio mese) si disattiva e resta solo
il tocco diretto sulla barra/frecce; su iOS e device performanti nulla cambia.

## 4. [ ] Coriandoli via `canvas-confetti` non sempre filtrati sui device deboli

`lib/motion.ts:14-17,29-40`. Già protetti da `prefers-reduced-motion` e da
`deviceMemory < 2GB`, ma molti Android di fascia media dichiarano 3-4GB pur avendo GPU deboli:
il check attuale non li intercetta. Impatto marginale (animazione una tantum), ma coerente con
i punti 2 e 3 se si introduce un heuristic più ampio (es. anche `hardwareConcurrency`).

## 5. [ ] Nessuna virtualizzazione sulle liste lunghe (rosa, obiettivi, badge)

Non specifico di Android, ma ogni card ha due box-shadow sovrapposte (`shadow-card`, vedi
`styles.css:160-171`) e gli `obiettivi` montano un `IntersectionObserver` per elemento
(`Reveal`). Con liste lunghe il costo si somma di più su CPU/GPU Android debole.

Da valutare solo se la rosa/obiettivi crescono molto: oggi la complessità aggiunta
(virtualizzazione) non sembra giustificata dal beneficio.

## 6. [x] Lag nel cambio pagina (Home ↔ Calendario ↔ Squadra ↔ Campionato) — APPLICATA

`BottomNav` resta montata su ogni rotta ([__root.tsx:204-210](src/routes/__root.tsx#L204-L210))
e concentrava due costi proprio nel momento del cambio pagina:

- `layoutId="capsula-nav"` di Framer Motion ([BottomNav.tsx](src/components/crapp/BottomNav.tsx))
  anima la pillola attiva con una misurazione di layout sincrona (FLIP) ad ogni navigazione.
- Il "vetro" della barra usa, solo su Blink/Android (`@supports (backdrop-filter: url(...))`),
  una catena di filtri SVG `feTurbulence` + `feGaussianBlur` + `feDisplacementMap` molto più
  pesante del semplice `blur()` che riceve iOS Safari — e ricalcola ad ogni cambio di contenuto
  sotto la barra fissa.

Fix: `BottomNav` ora usa `useMotoRidotto` (già in `lib/motion.ts`, copre sia
`prefers-reduced-motion` sia RAM bassa) al posto del solo `useReducedMotion` di Framer Motion.
Quando rileva un device debole, aggiunge `data-leggero` al contenitore `.vetro`; una nuova
regola in `styles.css` disattiva backdrop-filter su quell'attributo (fallback a sfondo pieno,
stesso trattamento già riservato a `prefers-reduced-transparency`). La molla della capsula era
già condizionata alla stessa variabile `ridotto`, quindi ora si disattiva anche lei sui device
deboli, non solo con `prefers-reduced-motion`.

Nessun impatto su iOS/device performanti: lì `ridotto` resta `false` e l'effetto vetro + la
capsula animata restano identici a prima.

## 7. [x] `classifica.tsx` (Campionato) ricalcolava entrambe le tab ad ogni render — APPLICATA

Stesso pattern di `squadra.tsx` (punto 1): `BarraSottosezioni` con le tab "Classifica" e
"Storico partite" costruiva il JSX di entrambe ad ogni render, incluso il merge tra partite CSI
e scout e il lookup MVP per data. Con `useCsi`/`useEventi`/`useVotiMvp` basati su TanStack Query,
un refetch in background di uno solo di questi dati rifaceva comunque il lavoro di tutt'e due
le tab. Meno grave del caso Squadra (qui non c'è uno stato locale tipo `aperto` che rirenderizza
il componente ad ogni tap), ma stesso spreco ad ogni mount/refetch della pagina.

Fix: stesso trattamento — `classifica`, `tuttiMatch`, `eventoIdPerData` e `mvpPerMatch` sono ora
memoizzati con `useMemo`, e il contenuto di ciascuna tab è a sua volta memoizzato sulle relative
dipendenze.

`index.tsx` (Home) non ha lo stesso problema: non usa `BarraSottosezioni`/tab multiple, quindi
non c'è contenuto "nascosto" che viene ricalcolato inutilmente — non modificata.

## 8. [x] Rifiniture minori — APPLICATA

- `TeamLogo` ([ui-bits.tsx](src/components/crapp/ui-bits.tsx)) non aveva `decoding="async"`
  (a differenza di `Avatar`): aggiunto, guadagno marginale ma gratuito.
- `.materiale` in `styles.css` (backdrop-filter 20px + 3 fallback di accessibilità) non era più
  referenziata da nessun componente — sostituita da `.vetro` sul `BottomNav` in un commit
  precedente (c089d9e) e da allora orfana. Rimossa insieme ai suoi fallback; il commento che la
  citava come confronto per `.vetro` è stato aggiornato.

## 9. [x] `LinkProfilo` (header di ogni pagina) tirava dentro tutte le statistiche della rosa
— APPLICATA

`ui-bits.tsx` (`LinkProfilo`, usato in `PageHeader` su quasi ogni rotta) usava `useIo`, che
internamente chiama `useRosa()`: quest'ultimo calcola l'**intera rosa arricchita** (voti MVP,
medie pagelle, statistiche cacche, turni palloni, infortuni/ritardi — 6 hook + un `useMemo`
pesante su tutta la squadra) solo per leggere `id` e iniziali di un giocatore.

Fix: `LinkProfilo` ora usa `useGiocatoreBase` (`lib/user-store.ts`, sola anagrafica da
`giocatori_squadra`) e calcola le iniziali con `inizialiDa` (ora esportata da `crapp-data.ts`),
senza toccare gli altri moduli statistici.

Verificato con build reale: le funzioni pesanti (`mediePagelle`, `statisticheCacche`,
`conteggioTurni`, `InfortuniERitardi`) sono sparite dal chunk `ui-bits`. **Attenzione**: la
dimensione totale del chunk non è cambiata (452KB) perché il grosso del peso è l'SDK Supabase
stesso, già necessario a monte in `__root.tsx` per il gate di login — non rimovibile da qui.
Il guadagno reale di questo fix è sul lavoro a runtime evitato (6 hook + memo in meno ad ogni
render dell'header), non sulla dimensione del bundle.

## 10. [x] Aprire Calendario montava la stessa rosa "pesante" solo per i compleanni — APPLICATA

`calendario.tsx` chiamava `useRosa()` (le stesse 6 statistiche del punto 9: MVP, pagelle,
cacche, palloni, infortuni/ritardi) ma usava il risultato **solo** per `compleanniEventi`, che
legge esclusivamente `id`, `nome` e `nascita`. Cliccare Calendario forzava quindi il calcolo (e,
la prima volta nella sessione, il fetch) di dati completamente estranei al calendario — probabile
causa diretta del lag "particolarmente su Calendario" segnalato.

Fix: nuovo hook `useAnagraficaRosa` in `rosa.ts` — solo `useGiocatoriSquadra` + lookup statico
`nascitaPerId`, senza gli altri 5 hook né il `useMemo` pesante. `compleanniEventi` (`eventi.ts`)
accetta ora `Pick<Giocatore, "id" | "nome" | "nascita">[]` invece dell'intero `Giocatore[]`,
riflettendo che è tutto ciò che usa.

## Note

- `useMotoRidotto` (`lib/motion.ts`) è ora l'heuristic condiviso di "device debole" usato in
  `BottomNav.tsx`, `BarraSottosezioni.tsx` e `calendario.tsx` (punti 2, 3, 6). Se si riprende il
  punto 4 (coriandoli), conviene usare lo stesso hook invece di un check separato.
- Applicati: 1, 2, 3, 6, 7, 8, 9, 10. Restano da discutere/prioritizzare: 4 (coriandoli su
  device medi), 5 (virtualizzazione liste lunghe).
- Pattern ricorrente (punti 9, 10): `useRosa()` è comodo ma calcola *tutte* le statistiche della
  squadra; usarlo solo per identità/anagrafica (id, nome, nascita, iniziali) costa 5-6 hook e un
  `useMemo` su tutta la rosa inutilmente. Se in futuro emerge un altro caso simile, riusare
  `useAnagraficaRosa` (o `useGiocatoreBase` per il singolo giocatore) invece di `useRosa`/`useIo`.
- Se il lag persistesse ancora dopo questi fix, il prossimo passo è profilare un device Android
  reale (Chrome DevTools remoto o `chrome://inspect`) invece di continuare a ipotizzare: a
  questo punto le cause "ovvie" lette dal codice sono coperte, e senza un trace reale si rischia
  di ottimizzare a caso.

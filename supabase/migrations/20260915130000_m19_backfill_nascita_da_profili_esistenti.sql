-- M19 — Backfill della nascita pubblica per i profili già esistenti (fix di M18)
--
-- M18 ha aggiunto `giocatori_squadra.nascita` e un trigger che la sincronizza da
-- `profili_giocatore.data_nascita`, ma quel trigger scatta solo sulle scritture *future*:
-- chi aveva già compilato il proprio profilo (data_nascita) prima che M18 fosse applicata è
-- rimasto con `nascita` vuota, mentre M18 aveva backfillato a mano solo i 17 giocatori del
-- seed storico. Effetto visibile: in Squadra la data di nascita compariva solo per quei 17,
-- non per chi l'aveva inserita dal Profilo prima di oggi.
--
-- Stesso motivo di M18 per disabilitare temporaneamente `enforce_giocatori_squadra_update`:
-- gira in un contesto senza `auth.uid()`, quindi non passerebbe nessun ramo del trigger.

ALTER TABLE public.giocatori_squadra DISABLE TRIGGER enforce_giocatori_squadra_update;

-- Ha la precedenza sui valori hardcoded di M18 per chi, tra i 17 storici, ha anche corretto
-- la propria data dal Profilo nel frattempo: `profili_giocatore` è la fonte più aggiornata.
UPDATE public.giocatori_squadra gs
SET nascita = pg.data_nascita
FROM public.profili_giocatore pg
WHERE pg.giocatore_id = gs.id;

ALTER TABLE public.giocatori_squadra ENABLE TRIGGER enforce_giocatori_squadra_update;

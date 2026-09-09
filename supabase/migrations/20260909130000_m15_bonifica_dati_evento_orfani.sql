-- M15 — Bonifica delle righe orfane lasciate da eventi cancellati prima di M14
--
-- M14 ha aggiunto un trigger che pulisce a cascata i dati collegati quando un evento viene
-- cancellato (DD-029), ma agisce solo sulle cancellazioni da quel momento in avanti. Questa
-- migration ripulisce una tantum le righe orfane lasciate da cancellazioni PRECEDENTI a M14.
--
-- Per `risposte_presenze`, `cacche_partita`, `turni_palloni`, `scout_sessioni`, `scout_live` e
-- `scout_partite`, `evento_id` ha sempre e solo indicato un id evento CrAPP (mai un altro
-- schema): qualsiasi riga il cui `evento_id` non esiste più in `eventi_app` è, senza ambiguità,
-- un orfano da una cancellazione passata (per `scout_partite`, `evento_id` può anche essere
-- legittimamente NULL — una partita scoutata mai collegata a un evento — e quelle righe non
-- vengono toccate).
--
-- `mvp_voti`, `pagelle_voti` e `badge_social_voti` sono diverse: PRIMA che `match_id`
-- diventasse l'id evento CrAPP, contenevano l'id di una sessione Scout (formato `s` + timestamp
-- in base 10, es. "s1717426810123") o la chiave di un referto CSI (id numerico del portale, o
-- fallback "data-squadra-squadra"). Quei voti sono dati storici legittimi, mai stati collegati
-- a un evento CrAPP: docs/modules/mvp.md li descrive come "non più letti da nessuna schermata",
-- non come dati da eliminare. Cancellarli qui sarebbe un bug, non una bonifica.
--
-- Il filtro `match_id ~ '^e[0-9a-z]+$'` isola solo i match_id nel formato di
-- `nuovoIdEvento()` (`"e" + Date.now().toString(36)`, src/lib/eventi.ts): nessun id Scout (che
-- inizia per "s") o CSI (numerico o con trattini) può rientrarci, quindi solo i veri orfani da
-- evento CrAPP cancellato vengono rimossi, mai un voto storico su id scout/CSI.

DELETE FROM public.risposte_presenze
WHERE evento_id NOT IN (SELECT id FROM public.eventi_app);

DELETE FROM public.cacche_partita
WHERE evento_id NOT IN (SELECT id FROM public.eventi_app);

DELETE FROM public.turni_palloni
WHERE evento_id NOT IN (SELECT id FROM public.eventi_app);

DELETE FROM public.scout_sessioni
WHERE evento_id NOT IN (SELECT id FROM public.eventi_app);

DELETE FROM public.scout_live
WHERE evento_id NOT IN (SELECT id FROM public.eventi_app);

DELETE FROM public.scout_partite
WHERE evento_id IS NOT NULL
  AND evento_id NOT IN (SELECT id FROM public.eventi_app);

DELETE FROM public.mvp_voti
WHERE match_id ~ '^e[0-9a-z]+$'
  AND match_id NOT IN (SELECT id FROM public.eventi_app);

DELETE FROM public.pagelle_voti
WHERE match_id ~ '^e[0-9a-z]+$'
  AND match_id NOT IN (SELECT id FROM public.eventi_app);

DELETE FROM public.badge_social_voti
WHERE match_id ~ '^e[0-9a-z]+$'
  AND match_id NOT IN (SELECT id FROM public.eventi_app);

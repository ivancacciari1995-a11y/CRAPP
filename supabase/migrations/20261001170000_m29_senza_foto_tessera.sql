-- M29 — Via la foto tessera dal profilo (DD-044)
--
-- Elimina la colonna `profili_giocatore.foto_path`. I file `<giocatore_id>/foto.*` nel bucket
-- privato `profili-giocatore` NON si cancellano da SQL (Storage lo vieta con un trigger): vanno
-- rimossi con l'API Storage, prima di questa migration, mentre i path sono ancora leggibili.
-- Da applicare DOPO il rilascio del codice che non legge più `foto_path`: l'app precedente
-- la seleziona esplicitamente e darebbe errore.

ALTER TABLE public.profili_giocatore DROP COLUMN IF EXISTS foto_path;

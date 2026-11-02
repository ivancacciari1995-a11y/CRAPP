-- M39 — Scout Live: valutazioni − / + per fondamentale.
--
-- Durante la partita lo scout può segnare, per ogni giocatore e per ogni set, un − o un +
-- su battuta, ricezione, attacco e muro. Non sono punti: restano fuori dal punteggio e da
-- `azioni`. Lo stato in corso le porta dentro `scout_live.stato` (jsonb, nessuna modifica);
-- la partita archiviata le conserva in questa colonna, accanto alle azioni.
-- Solo additiva: le partite già salvate ricevono l'elenco vuoto.

ALTER TABLE public.scout_partite
  ADD COLUMN valutazioni jsonb NOT NULL DEFAULT '[]'::jsonb;

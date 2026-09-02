-- M7 — Sincronizzazione dello Scout Live: blocco condiviso + archivio partite.
--
-- Bug 1 (nessuna modifica di schema qui): "chi sta scoutando" viveva solo in
-- localStorage (src/lib/scout-live.ts), quindi "Scout occupato da X" non
-- funzionava mai tra telefoni diversi. La tabella scout_sessioni esiste già
-- dalla migration 20260731122724 con i campi giusti (evento_id, giocatore_id,
-- giocatore_nome, aggiornato_il) ma non era mai stata collegata al codice
-- (vedi docs/DATABASE.md). Qui si aggiorna solo il codice TypeScript.
--
-- Bug 2: la partita scoutata finita veniva salvata solo in localStorage
-- (scout-store.ts, chiave crapp-scout-v1): "Punti/Ace/Muri squadra" in Squadra
-- e le presenze/MVP derivate dallo scout (useRosa) esistevano solo sul
-- telefono di chi aveva chiuso la partita. scout_partite archivia la partita
-- completa (azioni incluse) per tutta la squadra.

CREATE TABLE public.scout_partite (
  id text PRIMARY KEY,
  evento_id text,
  data date NOT NULL,
  avversario text NOT NULL,
  casa boolean NOT NULL DEFAULT true,
  set_nostri smallint NOT NULL,
  set_loro smallint NOT NULL,
  parziali jsonb NOT NULL DEFAULT '[]'::jsonb,
  azioni jsonb NOT NULL DEFAULT '[]'::jsonb,
  creato_il timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_partite TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_partite TO authenticated;
GRANT ALL ON public.scout_partite TO service_role;

ALTER TABLE public.scout_partite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chiunque puo leggere le partite scoutate" ON public.scout_partite
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Chiunque puo salvare una partita scoutata" ON public.scout_partite
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Chiunque puo modificare una partita scoutata" ON public.scout_partite
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Chiunque puo eliminare una partita scoutata" ON public.scout_partite
  FOR DELETE TO anon, authenticated USING (true);

-- La squadra è già autenticata da M4: chiude subito l'accesso anonimo, come per le
-- altre tabelle post-M4 (la policy resta dichiarata TO anon, authenticated: senza
-- GRANT il ruolo anon non arriva comunque alla tabella).
REVOKE ALL ON public.scout_partite FROM anon;

-- M16 — La bonifica di M15 diventa una funzione richiamabile e testabile
--
-- M15 ha ripulito una tantum le righe orfane lasciate da eventi cancellati prima di M14
-- (DD-029), con un blocco di DELETE eseguito una sola volta: non restava nulla da richiamare
-- né da testare in automatico, solo una verifica manuale fatta prima di applicarla.
--
-- Qui lo stesso corpo diventa la funzione `bonifica_dati_evento_orfani()`: se in futuro il
-- trigger di M14 venisse per errore rimosso o disattivato, o emergesse un altro batch di
-- orfani per un motivo imprevisto, si può rilanciare `select bonifica_dati_evento_orfani();`
-- invece di riscrivere da capo la stessa query delicata — e la sua logica resta coperta da
-- un test di integrazione (`test/integration/bonifica-evento.test.ts`) invece che verificata
-- a mano una tantum.
--
-- Riservata al service role: non è un'azione che un giocatore o un admin devono poter
-- richiamare dall'app, solo un intervento di manutenzione database.

CREATE OR REPLACE FUNCTION public.bonifica_dati_evento_orfani()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

  -- Solo i match_id nel formato di nuovoIdEvento() ("e" + timestamp base36): i vecchi voti
  -- storici su id Scout ("s" + timestamp) o CSI (numerico o "data-squadra-squadra") non
  -- rientrano nel filtro e restano intatti (vedi M15 per il dettaglio).
  DELETE FROM public.mvp_voti
  WHERE match_id ~ '^e[0-9a-z]+$'
    AND match_id NOT IN (SELECT id FROM public.eventi_app);

  DELETE FROM public.pagelle_voti
  WHERE match_id ~ '^e[0-9a-z]+$'
    AND match_id NOT IN (SELECT id FROM public.eventi_app);

  DELETE FROM public.badge_social_voti
  WHERE match_id ~ '^e[0-9a-z]+$'
    AND match_id NOT IN (SELECT id FROM public.eventi_app);
END;
$$;

REVOKE ALL ON FUNCTION public.bonifica_dati_evento_orfani() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bonifica_dati_evento_orfani() TO service_role;

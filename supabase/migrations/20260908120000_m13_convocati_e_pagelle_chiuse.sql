-- M13 — Le tabelle di voto controllano anche a database chi può votare chi.
--
-- Due gap segnalati in `docs/modules/badge.md` (audit del modulo Badge), entrambi finora
-- solo filtri applicativi, aggirabili da chi scrive direttamente su PostgREST:
--
--   1. Niente impediva di votare (o essere votati) da/per un giocatore non convocato
--      all'evento — vale per pagelle_voti, mvp_voti, badge_social_voti.
--   2. `eventi_app.pagelle_chiuse` nascondeva solo i bottoni in UI: un voto "fuori tempo"
--      restava tecnicamente possibile.
--
-- Le policy "Ognuno gestisce i propri voti ..." di M11 vengono estese con un controllo sui
-- convocati dell'evento: `convocati` vuoto significa "tutta la rosa" (stessa convenzione di
-- `convocatiEvento()` in eventi.ts), quindi il controllo si applica solo se la lista non è
-- vuota. Le policy admin restano invariate: un amministratore può correggere un voto anche
-- per un giocatore che non risultava convocato o dopo la chiusura delle pagelle.

CREATE OR REPLACE FUNCTION public.evento_permette_voto(
  p_match_id text, p_votante_id text, p_votato_id text, p_richiede_pagelle_aperte boolean
) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.eventi_app e
    WHERE e.id = p_match_id
      AND (cardinality(e.convocati) = 0 OR p_votante_id = ANY(e.convocati))
      AND (cardinality(e.convocati) = 0 OR p_votato_id = ANY(e.convocati))
      AND (NOT p_richiede_pagelle_aperte OR NOT e.pagelle_chiuse)
  );
$$;

-- --- pagelle: anche convocazione e chiusura --------------------------------------------
DROP POLICY "Ognuno gestisce i propri voti pagella" ON public.pagelle_voti;

CREATE POLICY "Ognuno gestisce i propri voti pagella" ON public.pagelle_voti
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
    AND public.evento_permette_voto(match_id, votante_id, votato_id, true)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
    AND public.evento_permette_voto(match_id, votante_id, votato_id, true)
  );

-- --- MVP: solo convocazione, la votazione non ha un flag di chiusura -------------------
DROP POLICY "Ognuno gestisce il proprio voto MVP" ON public.mvp_voti;

CREATE POLICY "Ognuno gestisce il proprio voto MVP" ON public.mvp_voti
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
    AND public.evento_permette_voto(match_id, votante_id, votato_id, false)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
    AND public.evento_permette_voto(match_id, votante_id, votato_id, false)
  );

-- --- badge social: solo convocazione, stesso motivo -------------------------------------
DROP POLICY "Ognuno gestisce i propri voti social" ON public.badge_social_voti;

CREATE POLICY "Ognuno gestisce i propri voti social" ON public.badge_social_voti
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
    AND public.evento_permette_voto(match_id, votante_id, votato_id, false)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
    AND public.evento_permette_voto(match_id, votante_id, votato_id, false)
  );

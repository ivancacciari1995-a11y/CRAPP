-- M35 — Il voto MVP è definitivo (DD-051)
--
-- Prima un giocatore poteva cambiare o togliere il proprio voto (policy FOR ALL, M11/M13). Ora può
-- solo inserirlo: UPDATE e DELETE restano agli admin (policy «Gli admin gestiscono tutti i voti
-- MVP», M11), che possono correggere un voto sbagliato. Il vincolo UNIQUE (match_id, votante_id)
-- fa il resto: un secondo voto sulla stessa partita viene rifiutato.

DROP POLICY "Ognuno gestisce il proprio voto MVP" ON public.mvp_voti;

CREATE POLICY "Ognuno registra il proprio voto MVP" ON public.mvp_voti
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
    AND public.evento_permette_voto(match_id, votante_id, votato_id, false)
  );

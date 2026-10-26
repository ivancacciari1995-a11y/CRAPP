-- M36 — Il voto MVP si controlla anche sulla presenza e sull'orario (DD-051)
--
-- Fino alla M35 il database controllava solo convocati e allenatori (`evento_permette_voto`): che
-- votante e votato fossero presenti, e che fossero passate 2 ore dall'inizio, lo faceva solo l'app.
-- Ora la policy di INSERT su `mvp_voti` usa `voto_mvp_consentito()`, che aggiunge:
--   - l'evento è una partita;
--   - votante e votato hanno risposto `presente` o `ritardo`;
--   - sono passate 2 ore dall'inizio (stesso valore di ORE_ATTESA_MVP in src/lib/mvp-voti.ts).
--
-- È una funzione nuova e non una modifica di `evento_permette_voto`, perché questa è usata anche da
-- pagelle e badge social, che non hanno queste regole. Gli admin restano fuori (policy M11): possono
-- ancora correggere. L'ora si legge in Europe/Rome; un `ora` vuoto o non valido vale mezzanotte,
-- come in `votoMvpAperto()`.

CREATE OR REPLACE FUNCTION public.voto_mvp_consentito(
  p_match_id text, p_votante_id text, p_votato_id text
) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.evento_permette_voto(p_match_id, p_votante_id, p_votato_id, false)
  AND EXISTS (
    SELECT 1 FROM public.eventi_app e
    WHERE e.id = p_match_id
      AND e.tipo = 'partita'
      AND ((e.data + CASE WHEN e.ora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                          THEN e.ora::time ELSE time '00:00' END)
             AT TIME ZONE 'Europe/Rome') + interval '2 hours' <= now()
  )
  -- votante e votato sono diversi (mvp_no_autovoto): due righe = entrambi presenti
  AND (
    SELECT count(DISTINCT r.giocatore_id)
    FROM public.risposte_presenze r
    WHERE r.evento_id = p_match_id
      AND r.giocatore_id IN (p_votante_id, p_votato_id)
      AND r.stato IN ('presente', 'ritardo')
  ) = 2;
$$;

DROP POLICY "Ognuno registra il proprio voto MVP" ON public.mvp_voti;

CREATE POLICY "Ognuno registra il proprio voto MVP" ON public.mvp_voti
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
    AND public.voto_mvp_consentito(match_id, votante_id, votato_id)
  );

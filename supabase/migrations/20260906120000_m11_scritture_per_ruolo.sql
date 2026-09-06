-- M11 — Le scritture seguono i permessi dell'interfaccia (DD-023).
--
-- Le tabelle della v1.0 avevano policy `USING (true)` per anon e authenticated. M4 ha
-- tolto il GRANT ad anon, ma per gli autenticati non era rimasto nessun limite: un
-- giocatore qualsiasi poteva cancellare tutti gli eventi o riscrivere il voto di un altro
-- parlando direttamente con PostgREST, senza passare dall'interfaccia che quei pulsanti
-- glieli nasconde.
--
-- Da qui in poi le policy dicono quello che i componenti già fanno:
--   eventi_app                                 -> solo admin (la rotta /eventi è loro)
--   risposte_presenze, cacche_partita          -> la propria riga (giocatore_id)
--   pagelle_voti, mvp_voti, badge_social_voti  -> il proprio voto (votante_id)
--   turni_palloni, scout_*                     -> invariate: nell'app non hanno gate
--
-- La lettura non cambia: resta aperta a tutti gli autenticati.
--
-- L'identità è lo slot di `giocatori_squadra` collegato all'account, con lo stesso
-- EXISTS usato dalle policy dei profili (migration di correzione, DD-017): la funzione
-- `mio_giocatore_id()` di M2 lì è stata rimossa e non va reintrodotta. Regge perché dopo
-- DD-018 il giocatore selezionato sul dispositivo è sempre lo slot dell'account.

-- --- eventi: li gestisce chi ha /eventi, cioè un amministratore ---------------------
DROP POLICY "Chiunque puo creare eventi"     ON public.eventi_app;
DROP POLICY "Chiunque puo modificare eventi" ON public.eventi_app;
DROP POLICY "Chiunque puo eliminare eventi"  ON public.eventi_app;

CREATE POLICY "Gli admin gestiscono gli eventi" ON public.eventi_app
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- --- presenze: ognuno risponde per sé ----------------------------------------------
DROP POLICY "Chiunque puo salvare la propria presenza"    ON public.risposte_presenze;
DROP POLICY "Chiunque puo aggiornare la propria presenza" ON public.risposte_presenze;
DROP POLICY "Chiunque puo togliere la propria presenza"   ON public.risposte_presenze;

CREATE POLICY "Ognuno gestisce la propria presenza" ON public.risposte_presenze
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = giocatore_id AND g.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = giocatore_id AND g.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Gli admin gestiscono tutte le presenze" ON public.risposte_presenze
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- --- cacche: ognuno dichiara le proprie --------------------------------------------
DROP POLICY "Chiunque puo dichiarare le cacche" ON public.cacche_partita;
DROP POLICY "Chiunque puo aggiornare le cacche" ON public.cacche_partita;
DROP POLICY "Chiunque puo cancellare le cacche" ON public.cacche_partita;

CREATE POLICY "Ognuno dichiara le proprie cacche" ON public.cacche_partita
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = giocatore_id AND g.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = giocatore_id AND g.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Gli admin gestiscono tutte le cacche" ON public.cacche_partita
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- --- pagelle: ognuno firma i propri voti -------------------------------------------
DROP POLICY "Chiunque puo votare le pagelle"                ON public.pagelle_voti;
DROP POLICY "Chiunque puo cambiare il proprio voto pagella" ON public.pagelle_voti;
DROP POLICY "Chiunque puo togliere il proprio voto pagella" ON public.pagelle_voti;

CREATE POLICY "Ognuno gestisce i propri voti pagella" ON public.pagelle_voti
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Gli admin gestiscono tutte le pagelle" ON public.pagelle_voti
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- --- MVP ----------------------------------------------------------------------------
DROP POLICY "Chiunque puo votare l MVP"             ON public.mvp_voti;
DROP POLICY "Chiunque puo cambiare il proprio voto" ON public.mvp_voti;
DROP POLICY "Chiunque puo togliere il proprio voto" ON public.mvp_voti;

CREATE POLICY "Ognuno gestisce il proprio voto MVP" ON public.mvp_voti
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Gli admin gestiscono tutti i voti MVP" ON public.mvp_voti
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- --- badge social -------------------------------------------------------------------
DROP POLICY "Chiunque puo votare i badge social"           ON public.badge_social_voti;
DROP POLICY "Chiunque puo cambiare il proprio voto social" ON public.badge_social_voti;
DROP POLICY "Chiunque puo togliere il proprio voto social" ON public.badge_social_voti;

CREATE POLICY "Ognuno gestisce i propri voti social" ON public.badge_social_voti
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Gli admin gestiscono tutti i voti social" ON public.badge_social_voti
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

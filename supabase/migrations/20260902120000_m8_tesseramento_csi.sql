-- M8 — Tracciamento tesseramento CSI (roadmap v1.1)
--
-- Fin qui il modulo Profilo Giocatore raccoglie solo i dati per compilare la domanda di
-- tesseramento (profili_giocatore) e li esporta in CSV; manca lo stato di chi è già
-- tesserato. Numero e data della tessera non sono un dato che il giocatore conosce in
-- anticipo o può autodichiarare: arrivano dal CSI dopo l'iscrizione effettiva, quindi vanno
-- in giocatori_squadra insieme agli altri campi che gestisce solo l'admin (numero, ruolo),
-- non in profili_giocatore che il giocatore scrive di sé stesso.

ALTER TABLE public.giocatori_squadra
  ADD COLUMN numero_tessera text,
  ADD COLUMN data_tessera date;

COMMENT ON COLUMN public.giocatori_squadra.numero_tessera IS
  'Numero della tessera CSI assegnata dal comitato, valorizzato solo a tesseramento avvenuto.';
COMMENT ON COLUMN public.giocatori_squadra.data_tessera IS
  'Data di rilascio della tessera CSI.';

-- Estende il trigger di DD-016/DD-018 (m5_email_giocatori_squadra): i due nuovi campi
-- restano scrivibili solo dall'admin, come numero/ruolo/attivo — un giocatore che reclama
-- il proprio slot non può includerli nello stesso UPDATE.
CREATE OR REPLACE FUNCTION public.enforce_giocatori_squadra_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF OLD.auth_user_id IS NULL
     AND NEW.auth_user_id = auth.uid()
     AND OLD.email IS NOT NULL
     AND lower(OLD.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     AND NEW.id IS NOT DISTINCT FROM OLD.id
     AND NEW.nome IS NOT DISTINCT FROM OLD.nome
     AND NEW.cognome IS NOT DISTINCT FROM OLD.cognome
     AND NEW.numero IS NOT DISTINCT FROM OLD.numero
     AND NEW.ruolo IS NOT DISTINCT FROM OLD.ruolo
     AND NEW.attivo IS NOT DISTINCT FROM OLD.attivo
     AND NEW.email IS NOT DISTINCT FROM OLD.email
     AND NEW.numero_tessera IS NOT DISTINCT FROM OLD.numero_tessera
     AND NEW.data_tessera IS NOT DISTINCT FROM OLD.data_tessera
     AND NEW.creato_il IS NOT DISTINCT FROM OLD.creato_il THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Aggiornamento non autorizzato su giocatori_squadra';
END;
$$;

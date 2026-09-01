-- M5 — Collegamento automatico per email al primo accesso (DD-018)
--
-- Sostituisce la scelta manuale del proprio slot in `/benvenuto` con un confronto tra
-- l'email dell'account Google e l'email registrata per ciascun giocatore. Additiva:
-- non tocca `profili_giocatore` né altre tabelle v1.0.

ALTER TABLE public.giocatori_squadra
  ADD COLUMN email text;

COMMENT ON COLUMN public.giocatori_squadra.email IS
  'Email nota in anticipo per il giocatore (non l''email personale in profili_giocatore): '
  'chiave del collegamento automatico account <-> giocatore al primo accesso (DD-018). '
  'NULL finché non nota: la riga resta non collegabile da nessuno.';

-- Case-insensitive, tollerante a più righe con email NULL (non ancora note).
CREATE UNIQUE INDEX giocatori_squadra_email_unica
  ON public.giocatori_squadra (lower(email))
  WHERE email IS NOT NULL;

-- Il trigger di DD-016 (m1_giocatori_squadra) blocca qualunque UPDATE che non arrivi da un
-- admin autenticato o dal giocatore stesso: durante la migration non c'è sessione, quindi
-- va disattivato solo per il seed e riattivato subito dopo.
ALTER TABLE public.giocatori_squadra DISABLE TRIGGER enforce_giocatori_squadra_update;

-- Solo le due email confermate finora; le altre 15 arriveranno con una migration futura.
UPDATE public.giocatori_squadra SET email = 'ivan.cacciari.1995@gmail.com' WHERE id = 'g4';
UPDATE public.giocatori_squadra SET email = 'davide3011@gmail.com'         WHERE id = 'g10';

ALTER TABLE public.giocatori_squadra ENABLE TRIGGER enforce_giocatori_squadra_update;

-- Estende il trigger di DD-016: oltre a "slot libero, nessun altro campo cambia", un
-- non-admin può collegarsi solo se l'email del token coincide con l'email della riga
-- (case-insensitive). Righe senza email restano bloccate per chiunque.
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
     AND NEW.creato_il IS NOT DISTINCT FROM OLD.creato_il THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Aggiornamento non autorizzato su giocatori_squadra';
END;
$$;

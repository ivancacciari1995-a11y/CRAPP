-- M18 — Data di nascita pubblica a tutta la squadra (DD-031)
--
-- In "Squadra" la data di nascita mostrava "Invalid Date" per chi l'aveva inserita da solo
-- dal proprio Profilo: quel valore finisce in `profili_giocatore.data_nascita`, tabella con
-- RLS "solo il proprio profilo o admin" (M2), mai letta da `useRosa()`/`useAnagraficaRosa()`
-- (src/lib/rosa.ts). Quelle funzioni leggevano solo la mappa statica `nascitaPerId` del seed
-- storico dei 17 giocatori originali (src/lib/crapp-data.ts) — pubblica perché bundlata nel
-- client, ma senza voce per chi si è aggiunto dopo.
--
-- Questa migration aggiunge la colonna pubblica prevista fin da DD-015 ("giocatori_squadra
-- non ha ancora questa colonna, DD-015 follow-up") e la tiene sincronizzata con
-- `profili_giocatore.data_nascita`: un solo input nel form Profilo, due destinazioni — quella
-- amministrativa esistente (RLS invariata) e questo specchio pubblico, leggibile da tutta la
-- rosa attiva con la stessa policy di sempre.

ALTER TABLE public.giocatori_squadra ADD COLUMN nascita date;

-- Backfill una tantum dei 17 giocatori storici (stessi valori di `rosaCSI` in
-- src/lib/crapp-data.ts, stesso ordine g1..g17 del seed di M1). Il trigger
-- `enforce_giocatori_squadra_update` (attivo dalla migration M1) rifiuterebbe questi UPDATE:
-- gira in un contesto senza `auth.uid()`, quindi non passa né il ramo admin né quello di
-- reclamazione. Va disabilitato solo per il backfill e riattivato subito dopo.
ALTER TABLE public.giocatori_squadra DISABLE TRIGGER enforce_giocatori_squadra_update;

UPDATE public.giocatori_squadra SET nascita = '1997-08-30' WHERE id = 'g1';
UPDATE public.giocatori_squadra SET nascita = '1996-12-07' WHERE id = 'g2';
UPDATE public.giocatori_squadra SET nascita = '2000-04-28' WHERE id = 'g3';
UPDATE public.giocatori_squadra SET nascita = '1995-05-01' WHERE id = 'g4';
UPDATE public.giocatori_squadra SET nascita = '1995-08-13' WHERE id = 'g5';
UPDATE public.giocatori_squadra SET nascita = '1996-02-01' WHERE id = 'g6';
UPDATE public.giocatori_squadra SET nascita = '1997-07-04' WHERE id = 'g7';
UPDATE public.giocatori_squadra SET nascita = '1994-05-28' WHERE id = 'g8';
UPDATE public.giocatori_squadra SET nascita = '2003-04-04' WHERE id = 'g9';
UPDATE public.giocatori_squadra SET nascita = '1998-11-30' WHERE id = 'g10';
UPDATE public.giocatori_squadra SET nascita = '2000-02-02' WHERE id = 'g11';
UPDATE public.giocatori_squadra SET nascita = '1999-10-03' WHERE id = 'g12';
UPDATE public.giocatori_squadra SET nascita = '2000-09-16' WHERE id = 'g13';
UPDATE public.giocatori_squadra SET nascita = '1996-12-13' WHERE id = 'g14';
UPDATE public.giocatori_squadra SET nascita = '1993-03-24' WHERE id = 'g15';
UPDATE public.giocatori_squadra SET nascita = '2001-04-18' WHERE id = 'g16';
UPDATE public.giocatori_squadra SET nascita = '1994-05-20' WHERE id = 'g17';

ALTER TABLE public.giocatori_squadra ENABLE TRIGGER enforce_giocatori_squadra_update;

-- Il trigger di sync (sotto) è SECURITY DEFINER e bypassa la RLS in scrittura su
-- giocatori_squadra (di proprietà dell'owner della tabella), ma `enforce_giocatori_squadra_update`
-- resta un trigger BEFORE UPDATE che scatta comunque: senza questo ramo, l'update annidato
-- fallirebbe con l'eccezione già in vigore per chi non è admin.
--
-- Non apre una scrittura diretta dal client: la policy di update per un non-admin resta
-- "Users can claim unassigned roster slot" (USING auth_user_id IS NULL) — una riga già
-- collegata non la supera nemmeno, quindi l'unica strada che raggiunge questo ramo è la
-- funzione di sync qui sotto, che gira con privilegi propri e ignora la RLS.
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

  -- Slot già collegato al chiamante: può cambiare solo `nascita` (M18). È la via percorsa
  -- dal trigger di sync qui sotto, mai da un client (vedi commento sopra).
  IF OLD.auth_user_id IS NOT NULL
     AND OLD.auth_user_id = auth.uid()
     AND NEW.auth_user_id IS NOT DISTINCT FROM OLD.auth_user_id
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

CREATE OR REPLACE FUNCTION public.sincronizza_nascita_pubblica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.giocatori_squadra SET nascita = NULL WHERE id = OLD.giocatore_id;
    RETURN OLD;
  END IF;

  UPDATE public.giocatori_squadra SET nascita = NEW.data_nascita WHERE id = NEW.giocatore_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sincronizza_nascita_pubblica
  AFTER INSERT OR UPDATE OR DELETE ON public.profili_giocatore
  FOR EACH ROW
  EXECUTE FUNCTION public.sincronizza_nascita_pubblica();

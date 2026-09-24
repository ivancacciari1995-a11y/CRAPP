-- M21 — Ruolo allenatore (DD-034, docs/modules/allenatore.md).
--
-- L'allenatore è una riga di giocatori_squadra con `tipo = 'allenatore'`: si collega per
-- email come i giocatori (DD-018) e riusa profilo, avatar e compleanno. Non gioca, quindi
-- non ha numero di maglia né ruolo in campo, non risponde alle presenze, non dichiara
-- cacche, non vota e non viene votato. Gestisce gli eventi come un admin.
--
-- Il permesso vive in user_roles (DD-011) come valore `allenatore` di app_role (M20). Non
-- lo scrive nessuno a mano: lo tiene allineato un trigger su giocatori_squadra, quindi è
-- l'admin a concederlo registrando lo slot, e l'allenatore non può auto-promuoversi perché
-- `tipo` lo cambia solo un admin.

-- --- Colonna tipo --------------------------------------------------------------------------

ALTER TABLE public.giocatori_squadra
  ADD COLUMN tipo text NOT NULL DEFAULT 'giocatore'
    CONSTRAINT giocatori_squadra_tipo_valido CHECK (tipo IN ('giocatore', 'allenatore'));

COMMENT ON COLUMN public.giocatori_squadra.tipo IS
  'giocatore (in rosa, convocabile, votabile) oppure allenatore (gestisce gli eventi, fuori '
  'dalla rosa di gioco). Scrivibile solo da un admin (DD-034).';

-- L'allenatore non ha numero di maglia: resta obbligatorio solo per i giocatori.
ALTER TABLE public.giocatori_squadra ALTER COLUMN numero DROP NOT NULL;
ALTER TABLE public.giocatori_squadra
  ADD CONSTRAINT giocatori_squadra_numero_giocatori
    CHECK (tipo = 'allenatore' OR numero IS NOT NULL);

-- --- Trigger sugli slot: tipo solo admin, nome e cognome anche all'allenatore ---------------
--
-- Stessi due rami di M18 (reclamo dello slot libero, sync della nascita sul proprio slot),
-- con `tipo` tra i campi bloccati. Il secondo ramo lascia cambiare nome e cognome solo se
-- lo slot è di un allenatore: per un giocatore restano dati squadra gestiti dall'admin.
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
     AND NEW.tipo IS NOT DISTINCT FROM OLD.tipo
     AND NEW.creato_il IS NOT DISTINCT FROM OLD.creato_il THEN
    RETURN NEW;
  END IF;

  -- Slot già collegato al chiamante: cambia `nascita` (sync di M18) e, se è un allenatore,
  -- nome e cognome.
  IF OLD.auth_user_id IS NOT NULL
     AND OLD.auth_user_id = auth.uid()
     AND NEW.auth_user_id IS NOT DISTINCT FROM OLD.auth_user_id
     AND NEW.id IS NOT DISTINCT FROM OLD.id
     AND (OLD.tipo = 'allenatore' OR NEW.nome IS NOT DISTINCT FROM OLD.nome)
     AND (OLD.tipo = 'allenatore' OR NEW.cognome IS NOT DISTINCT FROM OLD.cognome)
     AND NEW.numero IS NOT DISTINCT FROM OLD.numero
     AND NEW.ruolo IS NOT DISTINCT FROM OLD.ruolo
     AND NEW.attivo IS NOT DISTINCT FROM OLD.attivo
     AND NEW.email IS NOT DISTINCT FROM OLD.email
     AND NEW.numero_tessera IS NOT DISTINCT FROM OLD.numero_tessera
     AND NEW.data_tessera IS NOT DISTINCT FROM OLD.data_tessera
     AND NEW.tipo IS NOT DISTINCT FROM OLD.tipo
     AND NEW.creato_il IS NOT DISTINCT FROM OLD.creato_il THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Aggiornamento non autorizzato su giocatori_squadra';
END;
$$;

-- Fino a qui un giocatore non poteva aggiornare una riga già collegata (solo il reclamo di
-- uno slot libero, M1): l'allenatore ora può farlo sulla propria, per nome e cognome. Il
-- trigger sopra decide quali campi.
CREATE POLICY "L'allenatore aggiorna il proprio slot" ON public.giocatori_squadra
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() AND tipo = 'allenatore')
  WITH CHECK (auth_user_id = auth.uid() AND tipo = 'allenatore');

-- --- Ruolo in user_roles allineato allo slot ---------------------------------------------
--
-- Un account ha il ruolo `allenatore` finché è collegato a uno slot attivo di tipo
-- allenatore. Scollegare, disattivare o cambiare tipo lo toglie.
CREATE OR REPLACE FUNCTION public.sincronizza_ruolo_allenatore()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.auth_user_id IS NOT NULL
     AND (NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
          OR NEW.tipo <> 'allenatore' OR NOT NEW.attivo) THEN
    DELETE FROM public.user_roles
    WHERE user_id = OLD.auth_user_id AND role = 'allenatore'::public.app_role;
  END IF;

  IF NEW.auth_user_id IS NOT NULL AND NEW.tipo = 'allenatore' AND NEW.attivo THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.auth_user_id, 'allenatore'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sincronizza_ruolo_allenatore
  AFTER INSERT OR UPDATE OF auth_user_id, tipo, attivo ON public.giocatori_squadra
  FOR EACH ROW
  EXECUTE FUNCTION public.sincronizza_ruolo_allenatore();

-- --- Eventi: admin o allenatore -----------------------------------------------------------
DROP POLICY "Gli admin gestiscono gli eventi" ON public.eventi_app;

CREATE POLICY "Admin e allenatori gestiscono gli eventi" ON public.eventi_app
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'allenatore'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'allenatore'::public.app_role)
  );

-- --- Presenze e cacche: solo i giocatori rispondono per sé --------------------------------
DROP POLICY "Ognuno gestisce la propria presenza" ON public.risposte_presenze;

CREATE POLICY "Ognuno gestisce la propria presenza" ON public.risposte_presenze
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = giocatore_id AND g.auth_user_id = auth.uid() AND g.tipo = 'giocatore'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = giocatore_id AND g.auth_user_id = auth.uid() AND g.tipo = 'giocatore'
    )
  );

DROP POLICY "Ognuno dichiara le proprie cacche" ON public.cacche_partita;

CREATE POLICY "Ognuno dichiara le proprie cacche" ON public.cacche_partita
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = giocatore_id AND g.auth_user_id = auth.uid() AND g.tipo = 'giocatore'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = giocatore_id AND g.auth_user_id = auth.uid() AND g.tipo = 'giocatore'
    )
  );

-- --- Voti: l'allenatore non vota e non viene votato ---------------------------------------
--
-- Stessa firma di M13, quindi le policy di pagelle, MVP e badge social la usano già.
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
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.giocatori_squadra g
    WHERE g.id IN (p_votante_id, p_votato_id) AND g.tipo = 'allenatore'
  );
$$;

-- --- Promemoria evento: anche agli allenatori, convocati o no -----------------------------
CREATE OR REPLACE FUNCTION public.giocatori_destinatari_evento(p_evento_id text)
RETURNS SETOF text
LANGUAGE sql STABLE AS $$
  SELECT g.id
  FROM public.eventi_app e
  JOIN public.giocatori_squadra g
    ON g.attivo = true
   AND (g.tipo = 'allenatore' OR cardinality(e.convocati) = 0 OR g.id = ANY(e.convocati))
  WHERE e.id = p_evento_id;
$$;

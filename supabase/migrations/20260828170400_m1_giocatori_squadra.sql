-- M1 — Anagrafica operativa squadra (Profilo Giocatore v1.1, DD-016)
-- Tabella additive: non modifica alcuna tabella v1.0 esistente.

CREATE TABLE public.giocatori_squadra (
  id            text PRIMARY KEY,
  nome          text NOT NULL,
  cognome       text NOT NULL,
  numero        integer NOT NULL CHECK (numero > 0),
  ruolo         text NOT NULL,
  auth_user_id  uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  attivo        boolean NOT NULL DEFAULT true,
  creato_il     timestamptz NOT NULL DEFAULT now(),
  aggiornato_il timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT giocatori_squadra_id_formato CHECK (id ~ '^g[0-9]+$')
);

COMMENT ON TABLE public.giocatori_squadra IS
  'Anagrafica operativa della squadra (ID testuali g1..gN). Source of truth progressiva per la rosa.';

-- Enforce DD-016: il giocatore può solo reclamare uno slot libero (auth_user_id NULL → auth.uid()),
-- senza modificare altri campi. Gli admin possono aggiornare tutto, incluso il reset di auth_user_id.
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
     AND NEW.id IS NOT DISTINCT FROM OLD.id
     AND NEW.nome IS NOT DISTINCT FROM OLD.nome
     AND NEW.cognome IS NOT DISTINCT FROM OLD.cognome
     AND NEW.numero IS NOT DISTINCT FROM OLD.numero
     AND NEW.ruolo IS NOT DISTINCT FROM OLD.ruolo
     AND NEW.attivo IS NOT DISTINCT FROM OLD.attivo
     AND NEW.creato_il IS NOT DISTINCT FROM OLD.creato_il THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Aggiornamento non autorizzato su giocatori_squadra';
END;
$$;

CREATE TRIGGER enforce_giocatori_squadra_update
  BEFORE UPDATE ON public.giocatori_squadra
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_giocatori_squadra_update();

CREATE TRIGGER update_giocatori_squadra_aggiornato_il
  BEFORE UPDATE ON public.giocatori_squadra
  FOR EACH ROW
  EXECUTE FUNCTION public.update_aggiornato_il();

GRANT SELECT, UPDATE ON public.giocatori_squadra TO authenticated;
GRANT ALL ON public.giocatori_squadra TO service_role;

ALTER TABLE public.giocatori_squadra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active roster"
  ON public.giocatori_squadra
  FOR SELECT
  TO authenticated
  USING (
    attivo = true
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Users can claim unassigned roster slot"
  ON public.giocatori_squadra
  FOR UPDATE
  TO authenticated
  USING (auth_user_id IS NULL)
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Admins can manage roster"
  ON public.giocatori_squadra
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Seed da src/lib/crapp-data.ts (rosaCSI, ordine g1..g17).
-- Nome/cognome: primo token = nome, resto = cognome (es. "Carlo Di Castelnuovo" → Carlo / Di Castelnuovo).
INSERT INTO public.giocatori_squadra (id, nome, cognome, numero, ruolo) VALUES
  ('g1',  'Salvador',   'Battistella',      88, 'Libero'),
  ('g2',  'Mattias',    'Bologna',          73, 'Centrale'),
  ('g3',  'Alessandra', 'Brunacci',          8, 'Palleggiatore'),
  ('g4',  'Ivan',       'Cacciari',         23, 'Banda'),
  ('g5',  'Mattia',     'Catalano',         21, 'Palleggiatore'),
  ('g6',  'Silvia',     'Chilese',          11, 'Libero'),
  ('g7',  'Alessio',    'Cocco',            77, 'Centrale'),
  ('g8',  'Carlo',      'Di Castelnuovo',   14, 'Opposto'),
  ('g9',  'Camilla',    'Esposito',          7, 'Palleggiatore'),
  ('g10', 'Davide',     'Grilli',            1, 'Opposto'),
  ('g11', 'Antonella',  'Loverre',          22, 'Banda'),
  ('g12', 'Laura',      'Passabì',           5, 'Banda'),
  ('g13', 'Nicola',     'Pezzoli',           4, 'Centrale'),
  ('g14', 'Iacopo',     'Ricci',             2, 'Banda'),
  ('g15', 'Cristina',   'Titone',            3, 'Libero'),
  ('g16', 'Francesca',  'Tucci',            18, 'Centrale'),
  ('g17', 'Giada',      'Valbonesi',        10, 'Opposto');

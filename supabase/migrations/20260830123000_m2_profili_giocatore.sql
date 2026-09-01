-- M2 — Profilo giocatore + Storage privato (DD-016)
-- Tabella e bucket additive: non modifica alcuna tabella v1.0 esistente.

CREATE TYPE public.doc_identita_tipo AS ENUM (
  'carta_identita',
  'passaporto',
  'patente'
);

CREATE OR REPLACE FUNCTION public.mio_giocatore_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.giocatori_squadra
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.mio_giocatore_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mio_giocatore_id() TO authenticated;

CREATE TABLE public.profili_giocatore (
  giocatore_id          text PRIMARY KEY
                        REFERENCES public.giocatori_squadra(id) ON DELETE CASCADE,
  data_nascita          date,
  luogo_nascita         text,
  indirizzo             text,
  telefono              text,
  email                 text,
  doc_tipo              public.doc_identita_tipo,
  doc_numero            text,
  doc_rilasciato_da     text,
  doc_data_emissione    date,
  doc_data_scadenza     date,
  doc_fronte_path       text,
  doc_retro_path        text,
  cert_scadenza         date,
  cert_file_path        text,
  foto_tessera_path     text,
  avatar_path           text,
  creato_il             timestamptz NOT NULL DEFAULT now(),
  aggiornato_il         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profilo_date_doc_valide CHECK (
    doc_data_emissione IS NULL
    OR doc_data_scadenza IS NULL
    OR doc_data_emissione <= doc_data_scadenza
  )
);

COMMENT ON TABLE public.profili_giocatore IS
  'Dati personali e path documenti. File binari nel bucket privato profili-giocatore.';

CREATE OR REPLACE FUNCTION public.enforce_profili_giocatore_pk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.giocatore_id IS DISTINCT FROM OLD.giocatore_id THEN
    RAISE EXCEPTION 'giocatore_id non modificabile';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_profili_giocatore_pk
  BEFORE UPDATE ON public.profili_giocatore
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profili_giocatore_pk();

CREATE TRIGGER update_profili_giocatore_aggiornato_il
  BEFORE UPDATE ON public.profili_giocatore
  FOR EACH ROW
  EXECUTE FUNCTION public.update_aggiornato_il();

GRANT SELECT, INSERT, UPDATE ON public.profili_giocatore TO authenticated;
GRANT ALL ON public.profili_giocatore TO service_role;

ALTER TABLE public.profili_giocatore ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own profile"
  ON public.profili_giocatore
  FOR SELECT
  TO authenticated
  USING (
    giocatore_id = public.mio_giocatore_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Players can insert own profile"
  ON public.profili_giocatore
  FOR INSERT
  TO authenticated
  WITH CHECK (
    giocatore_id = public.mio_giocatore_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Players can update own profile"
  ON public.profili_giocatore
  FOR UPDATE
  TO authenticated
  USING (
    giocatore_id = public.mio_giocatore_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    giocatore_id = public.mio_giocatore_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins can delete profiles"
  ON public.profili_giocatore
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profili-giocatore',
  'profili-giocatore',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

CREATE POLICY "Players can read own profile files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'profili-giocatore'
    AND (
      (storage.foldername(name))[1] = public.mio_giocatore_id()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

CREATE POLICY "Players can upload own profile files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profili-giocatore'
    AND (
      (storage.foldername(name))[1] = public.mio_giocatore_id()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

CREATE POLICY "Players can overwrite own profile files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profili-giocatore'
    AND (
      (storage.foldername(name))[1] = public.mio_giocatore_id()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'profili-giocatore'
    AND (
      (storage.foldername(name))[1] = public.mio_giocatore_id()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

CREATE POLICY "Players can delete own profile files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profili-giocatore'
    AND (
      (storage.foldername(name))[1] = public.mio_giocatore_id()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

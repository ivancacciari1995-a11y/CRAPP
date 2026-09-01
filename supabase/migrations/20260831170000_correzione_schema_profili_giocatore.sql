-- Correzione schema profili_giocatore (post 20260830123000)
--
-- Prerequisito: la migration 20260830123000 deve essere già applicata (schema doc_*,
-- enum doc_identita_tipo, funzione mio_giocatore_id, policy inglesi).
-- Porta il database allo schema atteso dal codice di develop (20260830120000 + 20100).
-- Non modifica giocatori_squadra né le tabelle v1.0.
-- Supabase avvolge ogni migration in una transazione: non serve BEGIN/COMMIT esplicito
-- (inserirli nel file può interferire con db push).

-- ── 1. Policy tabella: rimuovi quelle che dipendono da mio_giocatore_id() ───
DROP POLICY "Players can view own profile" ON public.profili_giocatore;
DROP POLICY "Players can insert own profile" ON public.profili_giocatore;
DROP POLICY "Players can update own profile" ON public.profili_giocatore;

-- Policy admin separata: va sostituita dal modello Davide (FOR ALL).
DROP POLICY "Admins can delete profiles" ON public.profili_giocatore;

-- ── 2. Policy Storage: tutte usano mio_giocatore_id() ──────────────────────
DROP POLICY "Players can read own profile files" ON storage.objects;
DROP POLICY "Players can upload own profile files" ON storage.objects;
DROP POLICY "Players can overwrite own profile files" ON storage.objects;
DROP POLICY "Players can delete own profile files" ON storage.objects;

-- ── 3. Trigger e funzione PK enforcement (assenti nello schema Davide) ─────
DROP TRIGGER enforce_profili_giocatore_pk ON public.profili_giocatore;
DROP FUNCTION public.enforce_profili_giocatore_pk();

-- ── 4. Vincolo sulle date documento (prima delle rinomine di colonna) ────────
ALTER TABLE public.profili_giocatore
  DROP CONSTRAINT profilo_date_doc_valide;

-- ── 5. doc_tipo enum → documento_tipo text (valori UI del codice) ──────────
ALTER TABLE public.profili_giocatore
  ALTER COLUMN doc_tipo TYPE text
  USING (
    CASE doc_tipo::text
      WHEN 'carta_identita' THEN 'Carta d''identità'
      WHEN 'patente'         THEN 'Patente'
      WHEN 'passaporto'      THEN 'Passaporto'
      ELSE doc_tipo::text
    END
  );

ALTER TABLE public.profili_giocatore
  RENAME COLUMN doc_tipo TO documento_tipo;

-- ── 6. Rinomina colonne allo schema atteso da profili-core.ts ───────────────
ALTER TABLE public.profili_giocatore RENAME COLUMN doc_numero        TO documento_numero;
ALTER TABLE public.profili_giocatore RENAME COLUMN doc_rilasciato_da TO documento_rilasciato_da;
ALTER TABLE public.profili_giocatore RENAME COLUMN doc_data_emissione TO documento_emissione;
ALTER TABLE public.profili_giocatore RENAME COLUMN doc_data_scadenza  TO documento_scadenza;
ALTER TABLE public.profili_giocatore RENAME COLUMN doc_fronte_path   TO documento_fronte_path;
ALTER TABLE public.profili_giocatore RENAME COLUMN doc_retro_path    TO documento_retro_path;
ALTER TABLE public.profili_giocatore RENAME COLUMN cert_scadenza     TO certificato_scadenza;
ALTER TABLE public.profili_giocatore RENAME COLUMN cert_file_path    TO certificato_path;
ALTER TABLE public.profili_giocatore RENAME COLUMN foto_tessera_path TO foto_path;

-- ── 7. Colonna non usata dal codice ─────────────────────────────────────────
ALTER TABLE public.profili_giocatore DROP COLUMN avatar_path;

-- ── 8. Oggetti della migration 123000 non più necessari ─────────────────────
DROP FUNCTION public.mio_giocatore_id();
DROP TYPE public.doc_identita_tipo;

COMMENT ON TABLE public.profili_giocatore IS
  'Dati personali, documento e certificato di ciascun giocatore, 1:1 con giocatori_squadra. Vedi DD-016.';

-- ── 9. RLS tabella (modello Davide, DD-017) ─────────────────────────────────
CREATE POLICY "Il giocatore legge il proprio profilo" ON public.profili_giocatore
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = giocatore_id AND g.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Il giocatore crea il proprio profilo" ON public.profili_giocatore
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = giocatore_id AND g.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Il giocatore aggiorna il proprio profilo" ON public.profili_giocatore
  FOR UPDATE TO authenticated
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

CREATE POLICY "Gli admin gestiscono tutti i profili" ON public.profili_giocatore
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── 10. Policy Storage (DD-017: admin solo lettura) ─────────────────────────
CREATE POLICY "Il giocatore gestisce i propri file" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'profili-giocatore'
    AND EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = (storage.foldername(name))[1] AND g.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'profili-giocatore'
    AND EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = (storage.foldername(name))[1] AND g.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Gli admin scaricano tutti i file dei profili" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'profili-giocatore'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- ── 11. Bucket: resta privato; limiti MIME/dimensione invariati ─────────────
UPDATE storage.buckets
SET public = false
WHERE id = 'profili-giocatore';

-- M3 — Bucket privato per documenti, certificati e foto tessera (DD-016 regole 3 e 4)
-- Migration additiva. Il bucket nasce privato e resta privato: documenti d'identità e
-- dati sanitari non devono mai essere raggiungibili da un URL pubblico. L'accesso avviene
-- solo con client autenticato o con signed URL a scadenza breve generata per gli admin.

INSERT INTO storage.buckets (id, name, public)
VALUES ('profili-giocatore', 'profili-giocatore', false)
ON CONFLICT (id) DO NOTHING;

-- Convenzione dei path: `<giocatore_id>/<sezione>.<estensione>` (es. `g4/certificato.pdf`).
-- La prima cartella è l'ID del giocatore: è così che si riconosce il proprietario del file.
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

-- Gli admin scaricano i file di tutti, ma non li modificano: i documenti restano
-- in mano al giocatore che li ha caricati.
CREATE POLICY "Gli admin scaricano tutti i file dei profili" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'profili-giocatore'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

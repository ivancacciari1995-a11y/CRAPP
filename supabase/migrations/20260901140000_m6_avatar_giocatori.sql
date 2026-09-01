-- M6 — Bucket pubblico per le foto profilo dei giocatori (avatar).
--
-- Sostituisce l'attuale localStorage per-dispositivo (src/lib/avatar-store.ts):
-- senza un bucket condiviso ogni giocatore vedeva la propria foto solo sul
-- proprio telefono, mai quella dei compagni nella rosa (Squadra).
--
-- Bucket pubblico: sono foto profilo informali di una squadra amatoriale, non
-- documenti sensibili (quelli restano nel bucket privato profili-giocatore,
-- DD-016 regola 4). Segue il modello "chiunque autenticato può" già usato per
-- mvp_voti/eventi_app, non il modello per-proprietario di profili-giocatore:
-- la maggior parte dei giocatori non ha ancora auth_user_id collegato
-- (DD-018, oggi 2 su 17), quindi un controllo per-proprietario bloccherebbe
-- l'upload per quasi tutta la squadra. L'accesso all'app richiede comunque
-- login Google (DD-011, vedi src/routes/__root.tsx), quindi auth.uid() è
-- sempre valorizzato per chi usa davvero l'app.
--
-- Percorso file: '<giocatore_id>/avatar.jpg' (un solo file per giocatore,
-- sovrascritto a ogni caricamento).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatar-giocatori', 'avatar-giocatori', true, 2097152, ARRAY['image/jpeg']);

CREATE POLICY "Chiunque puo vedere gli avatar" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatar-giocatori');

CREATE POLICY "Gli autenticati caricano gli avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatar-giocatori');

CREATE POLICY "Gli autenticati sostituiscono gli avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatar-giocatori')
  WITH CHECK (bucket_id = 'avatar-giocatori');

CREATE POLICY "Gli autenticati eliminano gli avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatar-giocatori');

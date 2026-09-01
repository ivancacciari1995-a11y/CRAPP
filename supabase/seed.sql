-- Seed di sviluppo: gira solo in locale (`supabase start` e `supabase db reset`),
-- mai in produzione. Serve a vedere la dashboard amministratore con dati realistici
-- senza inserire righe finte nel database vero.
--
-- I path dei file puntano a oggetti che nel bucket non esistono: i pulsanti di download
-- falliscono finché non carichi qualcosa dall'app o dallo Studio (http://127.0.0.1:54323).

INSERT INTO public.profili_giocatore
  (giocatore_id, data_nascita, luogo_nascita, indirizzo, telefono, email,
   documento_tipo, documento_numero, documento_rilasciato_da,
   documento_emissione, documento_scadenza, documento_fronte_path, documento_retro_path,
   certificato_scadenza, certificato_path, foto_path)
VALUES
  -- Profilo completo al 100%.
  ('g1', '1997-08-30', 'Bologna', 'Via Roma 1', '3330000001', 'g1@example.test',
   'Carta d''identità', 'CA1000001', 'Comune di Bologna',
   '2021-03-01', '2031-03-01', 'g1/documento-fronte.jpg', 'g1/documento-retro.jpg',
   '2027-06-30', 'g1/certificato.pdf', 'g1/foto.jpg'),

  -- Certificato scaduto: in dashboard deve comparire rosso.
  ('g4', '1995-05-01', 'Bologna', 'Via Verdi 2', '3330000004', 'g4@example.test',
   'Carta d''identità', 'CA1000004', 'Comune di Bologna',
   '2019-05-01', '2029-05-01', 'g4/documento-fronte.jpg', 'g4/documento-retro.jpg',
   '2025-01-01', 'g4/certificato.pdf', 'g4/foto.jpg'),

  -- Profilo a metà: dati personali sì, documento no, certificato sì, foto no.
  ('g2', '1996-12-07', 'Modena', 'Via Bianchi 3', '3330000002', 'g2@example.test',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL,
   '2027-09-15', 'g2/certificato.pdf', NULL)
ON CONFLICT (giocatore_id) DO NOTHING;

-- Il primo amministratore non si può seminare qui: `user_roles.user_id` punta a un utente
-- di `auth.users`, che su un database appena creato non esiste ancora. Dopo il primo login
-- (in locale come in produzione) basta una riga:
--
--   INSERT INTO public.user_roles (user_id, role)
--   SELECT id, 'admin' FROM auth.users WHERE email = '<la tua mail>';

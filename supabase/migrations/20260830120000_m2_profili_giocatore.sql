-- M2 — Profilo Giocatore: dati personali, documento d'identità, certificato medico (DD-016)
-- Migration additiva: solo CREATE, nessuna modifica alle tabelle v1.0 esistenti.
-- I file non stanno qui: la tabella conserva solo i path dentro il bucket privato
-- `profili-giocatore` creato dalla migration M3.

CREATE TABLE public.profili_giocatore (
  giocatore_id            text PRIMARY KEY REFERENCES public.giocatori_squadra(id) ON DELETE CASCADE,

  -- Dati personali richiesti dal tesseramento CSI
  data_nascita            date,
  luogo_nascita           text,
  indirizzo               text,
  telefono                text,
  email                   text,

  -- Documento di identità
  documento_tipo          text,
  documento_numero        text,
  documento_rilasciato_da text,
  documento_emissione     date,
  documento_scadenza      date,
  -- Il documento si carica fronte e retro: il CSI li vuole entrambi.
  documento_fronte_path   text,
  documento_retro_path    text,

  -- Certificato medico (storico non conservato in v1: DD-010)
  certificato_scadenza    date,
  certificato_path        text,

  -- Foto tessera
  foto_path               text,

  creato_il               timestamptz NOT NULL DEFAULT now(),
  aggiornato_il           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profili_giocatore IS
  'Dati personali, documento e certificato di ciascun giocatore, 1:1 con giocatori_squadra. Vedi DD-016.';

CREATE TRIGGER update_profili_giocatore_aggiornato_il
  BEFORE UPDATE ON public.profili_giocatore
  FOR EACH ROW
  EXECUTE FUNCTION public.update_aggiornato_il();

ALTER TABLE public.profili_giocatore ENABLE ROW LEVEL SECURITY;

-- Il giocatore vede e modifica solo il proprio profilo: il collegamento passa
-- da giocatori_squadra.auth_user_id, che solo un admin può riassegnare (M1).
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

-- Gli admin leggono tutti i profili ed esportano i dati per il tesseramento.
CREATE POLICY "Gli admin gestiscono tutti i profili" ON public.profili_giocatore
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE ON public.profili_giocatore TO authenticated;
GRANT ALL ON public.profili_giocatore TO service_role;

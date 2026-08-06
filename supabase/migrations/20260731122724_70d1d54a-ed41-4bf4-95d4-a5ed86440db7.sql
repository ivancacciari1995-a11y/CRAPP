CREATE TABLE public.scout_sessioni (
  evento_id text PRIMARY KEY,
  giocatore_id text NOT NULL,
  giocatore_nome text NOT NULL,
  aggiornato_il timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_sessioni TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_sessioni TO authenticated;
GRANT ALL ON public.scout_sessioni TO service_role;
ALTER TABLE public.scout_sessioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chiunque puo leggere le sessioni scout" ON public.scout_sessioni FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Chiunque puo aprire una sessione scout" ON public.scout_sessioni FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Chiunque puo aggiornare la sessione scout" ON public.scout_sessioni FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Chiunque puo chiudere la sessione scout" ON public.scout_sessioni FOR DELETE TO anon, authenticated USING (true);
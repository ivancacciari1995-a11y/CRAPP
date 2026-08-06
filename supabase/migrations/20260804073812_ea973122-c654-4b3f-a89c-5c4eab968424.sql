CREATE TABLE public.scout_live (
  evento_id text PRIMARY KEY,
  stato jsonb NOT NULL DEFAULT '{}'::jsonb,
  aggiornato_il timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_live TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_live TO authenticated;
GRANT ALL ON public.scout_live TO service_role;

ALTER TABLE public.scout_live ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chiunque puo leggere lo scout live" ON public.scout_live FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Chiunque puo creare lo scout live" ON public.scout_live FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Chiunque puo aggiornare lo scout live" ON public.scout_live FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Chiunque puo eliminare lo scout live" ON public.scout_live FOR DELETE TO anon, authenticated USING (true);
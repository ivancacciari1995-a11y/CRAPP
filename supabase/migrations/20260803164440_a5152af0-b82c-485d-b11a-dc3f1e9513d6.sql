CREATE TABLE public.risposte_presenze (
  evento_id text NOT NULL,
  giocatore_id text NOT NULL,
  stato text NOT NULL,
  aggiornato_il timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evento_id, giocatore_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risposte_presenze TO anon, authenticated;
GRANT ALL ON public.risposte_presenze TO service_role;
ALTER TABLE public.risposte_presenze ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chiunque puo leggere le presenze" ON public.risposte_presenze FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Chiunque puo salvare la propria presenza" ON public.risposte_presenze FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Chiunque puo aggiornare la propria presenza" ON public.risposte_presenze FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Chiunque puo togliere la propria presenza" ON public.risposte_presenze FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.promemoria_push (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  titolo text NOT NULL,
  testo text NOT NULL,
  creato_il timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX promemoria_push_endpoint_idx ON public.promemoria_push (endpoint, creato_il DESC);
GRANT ALL ON public.promemoria_push TO service_role;
ALTER TABLE public.promemoria_push ENABLE ROW LEVEL SECURITY;
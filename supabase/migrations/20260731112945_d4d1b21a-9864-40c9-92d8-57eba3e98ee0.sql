CREATE TABLE public.turni_palloni (
  evento_id text PRIMARY KEY,
  giocatore_id text NOT NULL,
  aggiornato_da text,
  aggiornato_il timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.turni_palloni TO anon, authenticated;
GRANT ALL ON public.turni_palloni TO service_role;
ALTER TABLE public.turni_palloni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chiunque puo leggere i turni palloni" ON public.turni_palloni FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Chiunque puo creare i turni palloni" ON public.turni_palloni FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Chiunque puo modificare i turni palloni" ON public.turni_palloni FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Chiunque puo eliminare i turni palloni" ON public.turni_palloni FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giocatore_id text NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chiunque puo iscriversi alle notifiche" ON public.push_subscriptions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Chiunque puo aggiornare la propria iscrizione" ON public.push_subscriptions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Chiunque puo cancellare la propria iscrizione" ON public.push_subscriptions FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "Chiunque puo verificare le iscrizioni" ON public.push_subscriptions FOR SELECT TO anon, authenticated USING (true);
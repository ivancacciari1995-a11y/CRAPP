CREATE TABLE public.mvp_voti (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id text NOT NULL,
  votante_id text NOT NULL,
  votato_id text NOT NULL,
  votato_nome text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (match_id, votante_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mvp_voti TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mvp_voti TO authenticated;
GRANT ALL ON public.mvp_voti TO service_role;

ALTER TABLE public.mvp_voti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chiunque puo leggere i voti MVP" ON public.mvp_voti FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Chiunque puo votare l MVP" ON public.mvp_voti FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Chiunque puo cambiare il proprio voto" ON public.mvp_voti FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Chiunque puo togliere il proprio voto" ON public.mvp_voti FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_mvp_voti_updated_at
BEFORE UPDATE ON public.mvp_voti
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
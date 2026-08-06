CREATE TABLE public.badge_social_voti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  categoria text NOT NULL,
  votante_id text NOT NULL,
  votato_id text NOT NULL,
  votato_nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, categoria, votante_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.badge_social_voti TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badge_social_voti TO authenticated;
GRANT ALL ON public.badge_social_voti TO service_role;

ALTER TABLE public.badge_social_voti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chiunque puo leggere i voti social"
  ON public.badge_social_voti FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Chiunque puo votare i badge social"
  ON public.badge_social_voti FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Chiunque puo cambiare il proprio voto social"
  ON public.badge_social_voti FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Chiunque puo togliere il proprio voto social"
  ON public.badge_social_voti FOR DELETE TO anon, authenticated USING (true);

CREATE TRIGGER update_badge_social_voti_updated_at
  BEFORE UPDATE ON public.badge_social_voti
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX badge_social_voti_match_idx ON public.badge_social_voti (match_id);
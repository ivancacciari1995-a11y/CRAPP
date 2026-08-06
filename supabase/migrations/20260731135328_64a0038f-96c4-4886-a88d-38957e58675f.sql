CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.giocatori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  numero integer NOT NULL,
  ruolo text NOT NULL,
  nascita date NOT NULL,
  foto text,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
  creato_il timestamptz NOT NULL DEFAULT now(),
  aggiornato_il timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.giocatori TO authenticated;
GRANT ALL ON public.giocatori TO service_role;

ALTER TABLE public.giocatori ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view roster" ON public.giocatori
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.giocatori
  FOR UPDATE TO authenticated USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Admins can manage roster" ON public.giocatori
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.eventi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('partita', 'allenamento', 'evento', 'compleanno')),
  titolo text NOT NULL,
  data date NOT NULL,
  ora text NOT NULL,
  luogo text NOT NULL,
  avversario text,
  casa boolean,
  creato_da uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  creato_il timestamptz NOT NULL DEFAULT now(),
  aggiornato_il timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.eventi TO authenticated;
GRANT ALL ON public.eventi TO service_role;

ALTER TABLE public.eventi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view events" ON public.eventi
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage events" ON public.eventi
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.presenze (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid REFERENCES public.eventi(id) ON DELETE CASCADE NOT NULL,
  giocatore_id uuid REFERENCES public.giocatori(id) ON DELETE CASCADE NOT NULL,
  stato text NOT NULL CHECK (stato IN ('presente', 'assente', 'forse', 'ritardo', 'infortunato')),
  aggiornato_da uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aggiornato_il timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, giocatore_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presenze TO authenticated;
GRANT ALL ON public.presenze TO service_role;

ALTER TABLE public.presenze ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view presences" ON public.presenze
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own presence" ON public.presenze
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori g
      WHERE g.id = giocatore_id AND g.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori g
      WHERE g.id = giocatore_id AND g.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all presences" ON public.presenze
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.update_aggiornato_il()
RETURNS TRIGGER AS $$
BEGIN
  NEW.aggiornato_il = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_giocatori_aggiornato_il BEFORE UPDATE ON public.giocatori
  FOR EACH ROW EXECUTE FUNCTION public.update_aggiornato_il();

CREATE TRIGGER update_eventi_aggiornato_il BEFORE UPDATE ON public.eventi
  FOR EACH ROW EXECUTE FUNCTION public.update_aggiornato_il();

CREATE TRIGGER update_presenze_aggiornato_il BEFORE UPDATE ON public.presenze
  FOR EACH ROW EXECUTE FUNCTION public.update_aggiornato_il();

INSERT INTO public.giocatori (nome, numero, ruolo, nascita) VALUES
  ('Salvador Battistella', 1, 'Libero', '1997-08-30'),
  ('Mattias Bologna', 2, 'Centrale', '1996-12-07'),
  ('Alessandra Brunacci', 3, 'Palleggiatore', '2000-04-28'),
  ('Ivan Cacciari', 4, 'Schiacciatore laterale', '1995-05-01'),
  ('Mattia Catalano', 5, 'Palleggiatore', '1995-08-13'),
  ('Silvia Chilese', 6, 'Libero', '1996-02-01'),
  ('Alessio Cocco', 7, 'Centrale', '1997-07-04'),
  ('Carlo Di Castelnuovo', 8, 'Jolly', '1994-05-28'),
  ('Camilla Esposito', 9, 'Palleggiatore', '2003-04-04'),
  ('Davide Grilli', 10, 'Opposto', '1998-11-30'),
  ('Antonella Loverre', 11, 'Schiacciatore laterale', '2000-02-02'),
  ('Laura Passabì', 12, 'Schiacciatore laterale', '1999-10-03'),
  ('Nicola Pezzoli', 13, 'Centrale', '2000-09-16'),
  ('Iacopo Ricci', 14, 'Schiacciatore laterale', '1996-12-13'),
  ('Cristina Titone', 15, 'Libero', '1993-03-24'),
  ('Francesca Tucci', 16, 'Centrale', '2001-04-18'),
  ('Giada Valbonesi', 17, 'Opposto', '1994-05-20');

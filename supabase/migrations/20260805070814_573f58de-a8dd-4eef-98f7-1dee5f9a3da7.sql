-- 1) Eventi gestibili dagli amministratori
CREATE TABLE public.eventi_app (
  id text PRIMARY KEY,
  tipo text NOT NULL,
  titolo text NOT NULL,
  luogo text NOT NULL DEFAULT '',
  data date NOT NULL,
  ora text NOT NULL DEFAULT '20:30',
  note text NOT NULL DEFAULT '',
  convocati text[] NOT NULL DEFAULT '{}',
  campionato boolean NOT NULL DEFAULT false,
  pagelle_chiuse boolean NOT NULL DEFAULT false,
  creato_il timestamptz NOT NULL DEFAULT now(),
  aggiornato_il timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventi_app TO anon, authenticated;
GRANT ALL ON public.eventi_app TO service_role;

ALTER TABLE public.eventi_app ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chiunque puo leggere gli eventi" ON public.eventi_app FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Chiunque puo creare eventi" ON public.eventi_app FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Chiunque puo modificare eventi" ON public.eventi_app FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Chiunque puo eliminare eventi" ON public.eventi_app FOR DELETE TO anon, authenticated USING (true);

CREATE TRIGGER update_eventi_app_aggiornato_il
BEFORE UPDATE ON public.eventi_app
FOR EACH ROW EXECUTE FUNCTION public.update_aggiornato_il();

INSERT INTO public.eventi_app (id, tipo, titolo, luogo, data, ora, campionato) VALUES
  ('e1', 'partita', 'CRAP Volley vs Aurora Nera', 'PalaCRAP, Via dei Tigli 4', '2026-08-04', '21:00', true),
  ('e2', 'allenamento', 'Allenamento tecnico', 'Palestra Comunale', '2026-08-06', '20:30', false),
  ('e3', 'allenamento', 'Atletica + fondamentali', 'Palestra Comunale', '2026-08-08', '19:00', false),
  ('e4', 'evento', 'Pizzata di squadra', 'Da Peppino', '2026-08-10', '21:30', false),
  ('e5', 'partita', 'Volley Bruzzano vs CRAP Volley', 'PalaBruzzano', '2026-08-13', '21:15', true),
  ('e6', 'allenamento', 'Rifinitura pre-gara', 'Palestra Comunale', '2026-08-20', '20:30', false);

-- 2) Pagelle: voto anonimo 1-10 tra compagni
CREATE TABLE public.pagelle_voti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  votante_id text NOT NULL,
  votato_id text NOT NULL,
  voto smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagelle_voto_range CHECK (voto >= 1 AND voto <= 10),
  CONSTRAINT pagelle_no_autovoto CHECK (votante_id <> votato_id),
  CONSTRAINT pagelle_unico UNIQUE (match_id, votante_id, votato_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagelle_voti TO anon, authenticated;
GRANT ALL ON public.pagelle_voti TO service_role;

ALTER TABLE public.pagelle_voti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chiunque puo leggere le pagelle" ON public.pagelle_voti FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Chiunque puo votare le pagelle" ON public.pagelle_voti FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Chiunque puo cambiare il proprio voto pagella" ON public.pagelle_voti FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Chiunque puo togliere il proprio voto pagella" ON public.pagelle_voti FOR DELETE TO anon, authenticated USING (true);

CREATE TRIGGER update_pagelle_voti_updated_at
BEFORE UPDATE ON public.pagelle_voti
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Sondaggio cacche pre-partita
CREATE TABLE public.cacche_partita (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id text NOT NULL,
  giocatore_id text NOT NULL,
  quantita smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cacche_range CHECK (quantita >= 0 AND quantita <= 10),
  CONSTRAINT cacche_unico UNIQUE (evento_id, giocatore_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cacche_partita TO anon, authenticated;
GRANT ALL ON public.cacche_partita TO service_role;

ALTER TABLE public.cacche_partita ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chiunque puo leggere le cacche" ON public.cacche_partita FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Chiunque puo dichiarare le cacche" ON public.cacche_partita FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Chiunque puo aggiornare le cacche" ON public.cacche_partita FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Chiunque puo cancellare le cacche" ON public.cacche_partita FOR DELETE TO anon, authenticated USING (true);

CREATE TRIGGER update_cacche_partita_updated_at
BEFORE UPDATE ON public.cacche_partita
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
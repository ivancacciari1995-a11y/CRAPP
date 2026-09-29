-- M23 — I promemoria evento non ricompaiono più se il giocatore elimina la notifica (DD-037)
--
-- Fino a M22 `genera_promemoria_eventi()` evitava i doppioni con `ON CONFLICT DO NOTHING` sul
-- vincolo UNIQUE (giocatore_id, evento_id, tipo) di `notifiche_utente`: la riga della notifica
-- era l'unica traccia che il promemoria fosse già stato generato. Ma il giocatore può eliminare
-- la notifica (swipe o ×, DD-030): senza più la riga, al giro successivo del job (ogni ora per
-- il promemoria a 24 ore, ogni 15 minuti per quello a 3 ore, finché l'evento non inizia) il
-- promemoria veniva rigenerato come non letto e, dal trigger di M22, riaccodato per email.
--
-- Il registro `promemoria_eventi_generati` ricorda in modo indipendente che il promemoria è già
-- stato generato per (giocatore, evento, tipo). Eliminare la notifica non lo tocca: il
-- promemoria non torna, e non parte una nuova mail. Il registro sparisce con l'evento o con il
-- giocatore (ON DELETE CASCADE), come le altre tabelle collegate (DD-029).

CREATE TABLE public.promemoria_eventi_generati (
  giocatore_id text NOT NULL REFERENCES public.giocatori_squadra(id) ON DELETE CASCADE,
  evento_id text NOT NULL REFERENCES public.eventi_app(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('evento_promemoria_24h', 'evento_promemoria_3h')),
  generato_il timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (giocatore_id, evento_id, tipo)
);

COMMENT ON TABLE public.promemoria_eventi_generati IS
  'Promemoria evento già generati per giocatore, evento e tipo: indipendente da notifiche_utente, così eliminare la notifica non la fa rigenerare (M23, DD-037).';

-- Solo la funzione SECURITY DEFINER e la service role la toccano: RLS attiva senza policy.
ALTER TABLE public.promemoria_eventi_generati ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promemoria_eventi_generati FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.promemoria_eventi_generati TO service_role;

-- I promemoria già presenti in `notifiche_utente` risultano generati. Senza questo, la prima
-- notifica eliminata dopo la migration verrebbe rigenerata come prima.
INSERT INTO public.promemoria_eventi_generati (giocatore_id, evento_id, tipo)
SELECT giocatore_id, evento_id, tipo
FROM public.notifiche_utente
WHERE tipo IN ('evento_promemoria_24h', 'evento_promemoria_3h')
  AND evento_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Stessa firma e stessi criteri di M17 (i cron non cambiano). La differenza: prima si registra
-- il promemoria come generato, e la notifica si crea solo per le righe appena registrate. Il
-- vincolo UNIQUE su `notifiche_utente` resta come seconda difesa.
CREATE OR REPLACE FUNCTION public.genera_promemoria_eventi(p_tipo text, p_finestra interval)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH da_generare AS (
    SELECT d AS giocatore_id, e.id AS evento_id, e.titolo, e.data, e.ora
    FROM public.eventi_app e
    CROSS JOIN LATERAL public.giocatori_destinatari_evento(e.id) AS d
    WHERE public.ora_evento_a_time(e.ora) IS NOT NULL
      AND ((e.data + public.ora_evento_a_time(e.ora)) AT TIME ZONE 'Europe/Rome') - now()
          BETWEEN interval '0' AND p_finestra
  ),
  nuovi AS (
    INSERT INTO public.promemoria_eventi_generati (giocatore_id, evento_id, tipo)
    SELECT giocatore_id, evento_id, p_tipo FROM da_generare
    ON CONFLICT DO NOTHING
    RETURNING giocatore_id, evento_id
  )
  INSERT INTO public.notifiche_utente (giocatore_id, tipo, titolo, corpo, evento_id)
  SELECT g.giocatore_id, p_tipo, 'Promemoria: ' || g.titolo,
         to_char(g.data, 'DD/MM/YYYY') || ' alle ' || g.ora,
         g.evento_id
  FROM nuovi n
  JOIN da_generare g ON g.giocatore_id = n.giocatore_id AND g.evento_id = n.evento_id
  ON CONFLICT (giocatore_id, evento_id, tipo) DO NOTHING;
END;
$$;

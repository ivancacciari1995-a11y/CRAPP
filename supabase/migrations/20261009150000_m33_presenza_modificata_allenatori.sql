-- M33 — «Presenza modificata» anche agli allenatori (DD-050)
--
-- Fine della fase di prova della M32: l'avviso arriva agli admin e agli allenatori attivi (ruolo in
-- `user_roles` e slot attivo), tranne il giocatore a cui appartiene la presenza. Cambia solo la lista
-- dei ruoli nella funzione; trigger, tipo di notifica e code push/email restano quelli della M32.

CREATE OR REPLACE FUNCTION public.avvisa_presenza_modificata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evento_id_r text := CASE WHEN TG_OP = 'DELETE' THEN OLD.evento_id ELSE NEW.evento_id END;
  giocatore_r text := CASE WHEN TG_OP = 'DELETE' THEN OLD.giocatore_id ELSE NEW.giocatore_id END;
  prima text := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.stato END;
  dopo text := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.stato END;
  ev record;
  chi record;
BEGIN
  IF prima IS NOT DISTINCT FROM dopo THEN
    RETURN NULL;
  END IF;

  SELECT e.titolo, e.data, e.ora, e.tipo, public.inizio_evento(e.data, e.ora) AS inizio
  INTO ev
  FROM public.eventi_app e
  WHERE e.id = evento_id_r;

  IF NOT FOUND
     OR ev.tipo NOT IN ('partita', 'allenamento')
     OR ev.inizio IS NULL
     OR ev.inizio - now() NOT BETWEEN interval '0' AND interval '6 hours' THEN
    RETURN NULL;
  END IF;

  SELECT trim(g.nome || ' ' || g.cognome) AS nome_completo
  INTO chi
  FROM public.giocatori_squadra g
  WHERE g.id = giocatore_r;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifiche_utente (giocatore_id, tipo, titolo, corpo)
  SELECT d.id,
         'presenza_modificata',
         'Presenza modificata: ' || chi.nome_completo,
         'Evento: ' || ev.titolo
           || E'\nData: ' || to_char(ev.data, 'DD/MM/YYYY') || ', ore ' || ev.ora
           || E'\nDa: ' || public.nome_stato_presenza(prima)
           || E'\nA: ' || public.nome_stato_presenza(dopo)
  FROM public.giocatori_squadra d
  WHERE d.attivo = true
    AND d.id <> giocatore_r
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = d.auth_user_id
        AND ur.role IN ('admin', 'allenatore')
    );

  RETURN NULL;
END;
$$;

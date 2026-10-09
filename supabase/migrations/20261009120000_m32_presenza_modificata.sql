-- M32 — Avviso se una presenza cambia a meno di 6 ore dall'evento (DD-050)
--
-- Quando una riga di `risposte_presenze` cambia (nuova, modificata o ritirata) e mancano da 0 a 6 ore
-- all'inizio di una partita o di un allenamento, ai destinatari arriva una notifica «Presenza modificata».
--
-- FASE DI PROVA: i destinatari sono solo gli admin (DD-050, «Fase di prova»). Per aprirla agli allenatori
-- basta aggiungere 'allenatore' alla lista dei ruoli qui sotto, con una nuova migration.
--
-- Dal database in poi il resto è già fatto: il trigger di M22/M26 accoda l'email, quello delle push
-- (esteso qui con il tipo nuovo) accoda la push, la riga è il centro notifiche in-app (DD-038).

-- --- Tipo di notifica --------------------------------------------------------------------------

ALTER TABLE public.notifiche_utente DROP CONSTRAINT notifiche_utente_tipo_check;
ALTER TABLE public.notifiche_utente ADD CONSTRAINT notifiche_utente_tipo_check CHECK (
  tipo IN (
    'admin',
    'evento_promemoria_24h',
    'evento_promemoria_3h',
    'turno_palloni',
    'turno_palloni_12h',
    'turno_palloni_6h',
    'turno_palloni_3h',
    'turno_palloni_revocato',
    'sollecita_presenze',
    'sollecita_presenze_24h',
    'sollecita_presenze_12h',
    'sollecita_presenze_6h',
    'sondaggio_cacche',
    'compleanno',
    'compleanno_auguri',
    'presenza_modificata'
  )
);

-- --- Funzione e trigger ------------------------------------------------------------------------
--
-- `evento_id` resta NULL (come i messaggi `admin`): la UNIQUE (giocatore_id, evento_id, tipo) non si
-- applica e due modifiche dello stesso evento restano due notifiche distinte.
--
-- Cancellare un evento elimina le risposte con un trigger AFTER DELETE su `eventi_app` (M14): quando
-- scatta questo, l'evento non esiste più, quindi non parte nessun avviso.

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
        AND ur.role IN ('admin')
    );

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.avvisa_presenza_modificata() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nome_stato_presenza(p_stato text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_stato = 'ritardo' THEN 'in ritardo' ELSE coalesce(p_stato, 'nessuna risposta') END;
$$;

CREATE TRIGGER risposte_presenze_avvisa_modifica
  AFTER INSERT OR UPDATE OF stato OR DELETE ON public.risposte_presenze
  FOR EACH ROW
  EXECUTE FUNCTION public.avvisa_presenza_modificata();

-- --- Push: anche la presenza modificata --------------------------------------------------------
--
-- Stesso trigger di M31 con il tipo nuovo. L'email passa già dal trigger di M22/M26.

DROP TRIGGER notifiche_utente_accoda_push_promemoria ON public.notifiche_utente;
CREATE TRIGGER notifiche_utente_accoda_push_promemoria
  AFTER INSERT ON public.notifiche_utente
  FOR EACH ROW
  WHEN (NEW.tipo IN (
    'evento_promemoria_24h',
    'evento_promemoria_3h',
    'turno_palloni_12h',
    'turno_palloni_6h',
    'turno_palloni_3h',
    'turno_palloni_revocato',
    'sollecita_presenze_24h',
    'sollecita_presenze_12h',
    'sollecita_presenze_6h',
    'compleanno',
    'compleanno_auguri',
    'presenza_modificata'
  ))
  EXECUTE FUNCTION public.accoda_push_promemoria();

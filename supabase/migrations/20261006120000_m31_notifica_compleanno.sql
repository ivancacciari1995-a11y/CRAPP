-- M31 — Notifica di compleanno (DD-047, issue #11)
--
-- Ogni giorno, dalle 8:00 (fuso Europe/Rome), chi ha il compleanno riceve il solo titolo di auguri e tutti gli
-- altri membri attivi della squadra (allenatori compresi) ricevono il solo avviso «Oggi è il compleanno
-- di ...», senza corpo e senza età.
-- Se in un giorno compiono gli anni più persone, ogni destinatario riceve un solo messaggio: chi non
-- festeggia con tutti i nomi, ogni festeggiato solo i propri auguri.
--
-- Canali come le altre notifiche automatiche (DD-038): la riga in `notifiche_utente` genera la mail
-- (il trigger di M26 lascia passare i nuovi tipi) e, con M31, anche la push dalla coda.
--
-- 29 febbraio: il confronto è tra giorno e mese, quindi chi è nato il 29 febbraio viene avvisato solo
-- negli anni bisestili. Limite noto e accettato (DD-047): non c'è un ripiego al 28 febbraio.

-- --- Tipi di notifica --------------------------------------------------------------------------

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
    'compleanno_auguri'
  )
);

-- --- Registro ----------------------------------------------------------------------------------
--
-- Una riga per destinatario e giorno: ricorda che l'avviso di quel giorno è già stato generato,
-- anche se il giocatore elimina la notifica (come `promemoria_eventi_generati`, DD-037). Non è legato
-- a un evento: i compleanni non sono `eventi_app`. Sparisce con il giocatore (DD-029).

CREATE TABLE public.compleanni_notificati (
  giocatore_id text NOT NULL REFERENCES public.giocatori_squadra(id) ON DELETE CASCADE,
  giorno date NOT NULL,
  generato_il timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (giocatore_id, giorno)
);

COMMENT ON TABLE public.compleanni_notificati IS
  'Avvisi di compleanno già generati per destinatario e giorno: indipendente da notifiche_utente, così eliminare la notifica non la fa rigenerare (M31, DD-047).';

-- Solo la funzione SECURITY DEFINER e la service role la toccano: RLS attiva senza policy.
ALTER TABLE public.compleanni_notificati ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compleanni_notificati FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.compleanni_notificati TO service_role;

-- --- Job ---------------------------------------------------------------------------------------
--
-- Gira ogni ora e agisce solo dalle 8:00 in poi, ora locale: un giro mancato si recupera all'ora
-- dopo e il registro impedisce di generare due volte lo stesso avviso. `pg_cron` ragiona in UTC e
-- l'ora legale sposta l'ora locale di una ora: per questo l'ora si legge qui, in `Europe/Rome`.
--
-- Il registro è per destinatario e giorno: chi entra in squadra o inserisce la data di nascita dopo
-- che gli avvisi del giorno sono partiti non genera un secondo giro (DD-047).
--
-- `p_adesso` esiste per i test, che simulano un'altra data; il job lo chiama senza argomenti.

CREATE OR REPLACE FUNCTION public.genera_avvisi_compleanno(p_adesso timestamptz DEFAULT now())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  adesso timestamp := p_adesso AT TIME ZONE 'Europe/Rome';
  oggi date := (p_adesso AT TIME ZONE 'Europe/Rome')::date;
BEGIN
  IF extract(hour FROM adesso) < 8 THEN
    RETURN;
  END IF;

  WITH festeggiati AS (
    SELECT g.id, g.nome
    FROM public.giocatori_squadra g
    WHERE g.attivo = true
      AND g.nascita IS NOT NULL
      AND extract(month FROM g.nascita) = extract(month FROM oggi)
      AND extract(day FROM g.nascita) = extract(day FROM oggi)
  ),
  elenco AS (
    SELECT array_agg(nome ORDER BY nome, id COLLATE "C") AS nomi
    FROM festeggiati
  ),
  nuovi AS (
    INSERT INTO public.compleanni_notificati (giocatore_id, giorno)
    SELECT g.id, oggi
    FROM public.giocatori_squadra g
    WHERE g.attivo = true
      AND EXISTS (SELECT 1 FROM festeggiati)
    ON CONFLICT DO NOTHING
    RETURNING giocatore_id
  )
  INSERT INTO public.notifiche_utente (giocatore_id, tipo, titolo, corpo)
  SELECT n.giocatore_id, 'compleanno_auguri',
         'Buon compleanno, ' || f.nome || '! 🎂',
         ''
  FROM nuovi n
  JOIN festeggiati f ON f.id = n.giocatore_id
  UNION ALL
  SELECT n.giocatore_id, 'compleanno',
         'Oggi è il compleanno di '
           || CASE WHEN cardinality(e.nomi) = 1 THEN e.nomi[1]
                   ELSE array_to_string(e.nomi[1:cardinality(e.nomi) - 1], ', ')
                        || ' e ' || e.nomi[cardinality(e.nomi)]
              END,
         ''
  FROM nuovi n
  CROSS JOIN elenco e
  WHERE NOT EXISTS (SELECT 1 FROM festeggiati f WHERE f.id = n.giocatore_id);
END;
$$;

REVOKE ALL ON FUNCTION public.genera_avvisi_compleanno(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.genera_avvisi_compleanno(timestamptz) TO service_role;

SELECT cron.schedule(
  'avvisi-compleanno',
  '0 * * * *',
  $$ SELECT public.genera_avvisi_compleanno() $$
);

-- --- Push: anche i compleanni ------------------------------------------------------------------
--
-- Nascono nel database come le altre notifiche automatiche: nessuna route le manda, quindi la push
-- passa dalla coda (DD-038). Stesso trigger di M26 con i due tipi nuovi.

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
    'compleanno_auguri'
  ))
  EXECUTE FUNCTION public.accoda_push_promemoria();

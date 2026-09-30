-- M26 — Notifiche automatiche di promemoria, turno palloni e sollecito presenze (DD-040)
--
-- Cosa cambia rispetto a M17/M23/M24:
--
--   1. I promemoria a 24 e 3 ore hanno un testo nuovo, con data, ora e luogo; la parola «domani»
--      compare se la data dell'evento è quella di domani (fuso Europe/Rome), «oggi» altrimenti.
--   2. Il turno palloni parte anche da solo, a 12, 6 e 3 ore dall'inizio, per gli allenamenti e le
--      partite con un incaricato *confermato* in `turni_palloni`: all'incaricato e, se è un'altra
--      persona, a chi aveva i palloni all'evento precedente. Se l'incaricato cambia dopo un
--      avviso, chi lo aveva ricevuto riceve una sola revoca.
--   3. Il sollecito presenze parte da solo a 24, 12 e 6 ore dall'inizio, a chi tra i destinatari
--      dell'evento non ha risposto o ha risposto «forse».
--   4. Le notifiche del turno palloni non generano email: restano push e centro notifiche.
--
-- I pulsanti manuali («Avvisa chi è di turno», «Sollecita») restano: usano gli stessi testi (vedi
-- `src/lib/palloni-core.ts` e `src/lib/presenze.ts`) e mandano la push dalla route, non dalla coda.
--
-- Le fasce sono contigue e senza sovrapposizione: un evento creato a meno di 12 ore dall'inizio
-- riceve solo la notifica della fascia in cui cade, non tutte insieme. Ogni notifica automatica si
-- genera una sola volta per (giocatore, evento, tipo), anche se il giocatore la elimina: lo ricorda
-- il registro `promemoria_eventi_generati` (M23, DD-037), che qui si estende ai tipi nuovi.

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
    'sondaggio_cacche'
  )
);

ALTER TABLE public.promemoria_eventi_generati DROP CONSTRAINT promemoria_eventi_generati_tipo_check;
ALTER TABLE public.promemoria_eventi_generati ADD CONSTRAINT promemoria_eventi_generati_tipo_check CHECK (
  tipo IN (
    'evento_promemoria_24h',
    'evento_promemoria_3h',
    'turno_palloni_12h',
    'turno_palloni_6h',
    'turno_palloni_3h',
    'turno_palloni_revocato',
    'sollecita_presenze_24h',
    'sollecita_presenze_12h',
    'sollecita_presenze_6h'
  )
);

-- --- Istante d'inizio di un evento -------------------------------------------------------------
--
-- `data` e `ora` sono ora locale Italia (stessa convenzione di M10 e M17). `ora` è testo libero: se
-- non è un'ora valida il risultato è NULL e l'evento viene solo escluso (vedi `ora_evento_a_time`).

CREATE OR REPLACE FUNCTION public.inizio_evento(p_data date, p_ora text)
RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT (p_data + public.ora_evento_a_time(p_ora)) AT TIME ZONE 'Europe/Rome';
$$;

-- --- Promemoria a 24 e 3 ore: testo nuovo ------------------------------------------------------
--
-- Stessa firma e stessi criteri di M23 (i cron non cambiano). Cambia solo il testo: titolo
-- «Promemoria evento di domani|oggi: <titolo>», corpo con Data, Ora e, se c'è, Luogo.

CREATE OR REPLACE FUNCTION public.genera_promemoria_eventi(p_tipo text, p_finestra interval)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH da_generare AS (
    SELECT d AS giocatore_id, e.id AS evento_id, e.titolo, e.data, e.ora, e.luogo,
           CASE WHEN e.data = ((now() AT TIME ZONE 'Europe/Rome')::date + 1)
                THEN 'domani' ELSE 'oggi' END AS parola
    FROM public.eventi_app e
    CROSS JOIN LATERAL public.giocatori_destinatari_evento(e.id) AS d
    WHERE public.inizio_evento(e.data, e.ora) IS NOT NULL
      AND public.inizio_evento(e.data, e.ora) - now() BETWEEN interval '0' AND p_finestra
  ),
  nuovi AS (
    INSERT INTO public.promemoria_eventi_generati (giocatore_id, evento_id, tipo)
    SELECT giocatore_id, evento_id, p_tipo FROM da_generare
    ON CONFLICT DO NOTHING
    RETURNING giocatore_id, evento_id
  )
  INSERT INTO public.notifiche_utente (giocatore_id, tipo, titolo, corpo, evento_id)
  SELECT g.giocatore_id, p_tipo,
         'Promemoria evento di ' || g.parola || ': ' || g.titolo,
         'Data: ' || g.parola || ', ' || to_char(g.data, 'DD/MM/YYYY')
           || E'\nOra: ' || g.ora
           || CASE WHEN btrim(g.luogo) <> '' THEN E'\nLuogo: ' || btrim(g.luogo) ELSE '' END,
         g.evento_id
  FROM nuovi n
  JOIN da_generare g ON g.giocatore_id = n.giocatore_id AND g.evento_id = n.evento_id
  ON CONFLICT (giocatore_id, evento_id, tipo) DO NOTHING;
END;
$$;

-- --- Turno palloni automatico ------------------------------------------------------------------
--
-- «Evento precedente» e «evento successivo» seguono `eventoPrecedente()`/`eventoSuccessivo()` di
-- `src/lib/palloni-core.ts`: solo allenamenti e partite, in ordine di data (a parità, di ora). La
-- logica è volutamente la stessa in due posti (il database non può chiamare il codice dell'app):
-- `test/integration/notifiche-automatiche.test.ts` li confronta sugli stessi dati.

-- Avvisi della fascia [p_da, p_a) prima dell'inizio. Parte solo se l'evento ha un incaricato
-- confermato in `turni_palloni`; i destinatari devono essere giocatori attivi.
CREATE OR REPLACE FUNCTION public.genera_avvisi_palloni_fascia(
  p_tipo text, p_da interval, p_a interval
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ev AS (
    SELECT e.id, e.titolo, e.data, e.ora,
           public.inizio_evento(e.data, e.ora) AS inizio,
           lag(e.id) OVER ordine AS precedente_id,
           lead(e.data) OVER ordine AS successivo_data
    FROM public.eventi_app e
    WHERE e.tipo IN ('allenamento', 'partita')
    WINDOW ordine AS (
      ORDER BY e.data, public.ora_evento_a_time(e.ora), e.id COLLATE "C"
    )
  ),
  turni AS (
    SELECT ev.*, t.giocatore_id AS incaricato, tp.giocatore_id AS precedente
    FROM ev
    JOIN public.turni_palloni t ON t.evento_id = ev.id
    LEFT JOIN public.turni_palloni tp ON tp.evento_id = ev.precedente_id
    WHERE ev.inizio IS NOT NULL
      AND ev.inizio - now() >= p_da
      AND ev.inizio - now() < p_a
  ),
  destinatari AS (
    SELECT incaricato AS giocatore_id, id AS evento_id, true AS e_incaricato,
           titolo, data, ora, successivo_data
    FROM turni
    UNION ALL
    SELECT precedente, id, false, titolo, data, ora, successivo_data
    FROM turni
    WHERE precedente IS NOT NULL AND precedente <> incaricato
  ),
  validi AS (
    SELECT d.*
    FROM destinatari d
    JOIN public.giocatori_squadra g
      ON g.id = d.giocatore_id AND g.attivo = true AND g.tipo = 'giocatore'
  ),
  nuovi AS (
    INSERT INTO public.promemoria_eventi_generati (giocatore_id, evento_id, tipo)
    SELECT giocatore_id, evento_id, p_tipo FROM validi
    ON CONFLICT DO NOTHING
    RETURNING giocatore_id, evento_id
  )
  INSERT INTO public.notifiche_utente (giocatore_id, tipo, titolo, corpo, evento_id)
  SELECT v.giocatore_id, p_tipo,
         CASE WHEN v.e_incaricato THEN 'Turno palloni: incarico assegnato'
              ELSE 'Turno palloni: riconsegna' END,
         'Evento: ' || v.titolo
           || E'\nData: ' || to_char(v.data, 'DD/MM/YYYY') || ', ore ' || v.ora
           || CASE WHEN v.e_incaricato
                   THEN E'\nIncarico: custodia dei palloni al termine dell''evento'
                        || CASE WHEN v.successivo_data IS NOT NULL
                                THEN E'\nRiconsegna: ' || to_char(v.successivo_data, 'DD/MM/YYYY')
                                ELSE '' END
                   ELSE E'\nIncarico: riconsegna dei palloni in custodia dal turno precedente'
              END,
         v.evento_id
  FROM nuovi n
  JOIN validi v ON v.giocatore_id = n.giocatore_id AND v.evento_id = n.evento_id
  ON CONFLICT (giocatore_id, evento_id, tipo) DO NOTHING;
END;
$$;

-- Revoca: chi ha ricevuto un avviso automatico per un evento non ancora iniziato e non è più
-- destinatario (incaricato cambiato o tolto, o turno precedente riassegnato) riceve una sola volta
-- «incarico revocato». Si guarda il registro, non `notifiche_utente`: il giocatore può aver
-- eliminato l'avviso. Gli avvisi del pulsante non contano: possono riguardare una proposta non
-- confermata, che qui non esiste.
CREATE OR REPLACE FUNCTION public.genera_revoche_palloni()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ev AS (
    SELECT e.id, e.titolo, e.data, e.ora,
           public.inizio_evento(e.data, e.ora) AS inizio,
           lag(e.id) OVER ordine AS precedente_id
    FROM public.eventi_app e
    WHERE e.tipo IN ('allenamento', 'partita')
    WINDOW ordine AS (
      ORDER BY e.data, public.ora_evento_a_time(e.ora), e.id COLLATE "C"
    )
  ),
  attuali AS (
    SELECT t.giocatore_id, ev.id AS evento_id
    FROM ev JOIN public.turni_palloni t ON t.evento_id = ev.id
    UNION
    SELECT tp.giocatore_id, ev.id
    FROM ev
    JOIN public.turni_palloni t ON t.evento_id = ev.id
    JOIN public.turni_palloni tp ON tp.evento_id = ev.precedente_id
    JOIN public.giocatori_squadra g ON g.id = tp.giocatore_id
    WHERE tp.giocatore_id <> t.giocatore_id
  ),
  da_revocare AS (
    SELECT DISTINCT r.giocatore_id, r.evento_id, ev.titolo, ev.data, ev.ora
    FROM public.promemoria_eventi_generati r
    JOIN ev ON ev.id = r.evento_id
    WHERE r.tipo IN ('turno_palloni_12h', 'turno_palloni_6h', 'turno_palloni_3h')
      AND ev.inizio IS NOT NULL
      AND ev.inizio >= now()
      AND NOT EXISTS (
        SELECT 1 FROM attuali a
        JOIN public.giocatori_squadra g
          ON g.id = a.giocatore_id AND g.attivo = true AND g.tipo = 'giocatore'
        WHERE a.giocatore_id = r.giocatore_id AND a.evento_id = r.evento_id
      )
  ),
  nuovi AS (
    INSERT INTO public.promemoria_eventi_generati (giocatore_id, evento_id, tipo)
    SELECT giocatore_id, evento_id, 'turno_palloni_revocato' FROM da_revocare
    ON CONFLICT DO NOTHING
    RETURNING giocatore_id, evento_id
  )
  INSERT INTO public.notifiche_utente (giocatore_id, tipo, titolo, corpo, evento_id)
  SELECT d.giocatore_id, 'turno_palloni_revocato',
         'Turno palloni: incarico revocato',
         'Evento: ' || d.titolo
           || E'\nData: ' || to_char(d.data, 'DD/MM/YYYY') || ', ore ' || d.ora
           || E'\nIncarico: non più a tuo carico per questo evento',
         d.evento_id
  FROM nuovi n
  JOIN da_revocare d ON d.giocatore_id = n.giocatore_id AND d.evento_id = n.evento_id
  ON CONFLICT (giocatore_id, evento_id, tipo) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.genera_avvisi_palloni()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.genera_avvisi_palloni_fascia('turno_palloni_12h', interval '6 hours', interval '12 hours');
  PERFORM public.genera_avvisi_palloni_fascia('turno_palloni_6h', interval '3 hours', interval '6 hours');
  PERFORM public.genera_avvisi_palloni_fascia('turno_palloni_3h', interval '0', interval '3 hours');
  PERFORM public.genera_revoche_palloni();
END;
$$;

-- --- Sollecito presenze automatico -------------------------------------------------------------
--
-- Destinatari: quelli dell'evento (`giocatori_destinatari_evento`: convocati, o tutta la rosa
-- attiva se `convocati` è vuoto; mai gli allenatori) che in quel momento non hanno una risposta o
-- hanno risposto «forse».

CREATE OR REPLACE FUNCTION public.genera_solleciti_presenze_fascia(
  p_tipo text, p_da interval, p_a interval
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH da_generare AS (
    SELECT d.gid AS giocatore_id, e.id AS evento_id, e.titolo, e.data, e.ora, e.luogo, r.stato
    FROM public.eventi_app e
    CROSS JOIN LATERAL public.giocatori_destinatari_evento(e.id) AS d(gid)
    LEFT JOIN public.risposte_presenze r
      ON r.evento_id = e.id AND r.giocatore_id = d.gid
    WHERE public.inizio_evento(e.data, e.ora) IS NOT NULL
      AND public.inizio_evento(e.data, e.ora) - now() >= p_da
      AND public.inizio_evento(e.data, e.ora) - now() < p_a
      AND (r.stato IS NULL OR r.stato = 'forse')
  ),
  nuovi AS (
    INSERT INTO public.promemoria_eventi_generati (giocatore_id, evento_id, tipo)
    SELECT giocatore_id, evento_id, p_tipo FROM da_generare
    ON CONFLICT DO NOTHING
    RETURNING giocatore_id, evento_id
  )
  INSERT INTO public.notifiche_utente (giocatore_id, tipo, titolo, corpo, evento_id)
  SELECT g.giocatore_id, p_tipo,
         'Conferma di partecipazione richiesta: ' || g.titolo,
         'Data: ' || to_char(g.data, 'DD/MM/YYYY')
           || E'\nOra: ' || g.ora
           || CASE WHEN btrim(g.luogo) <> '' THEN E'\nLuogo: ' || btrim(g.luogo) ELSE '' END
           || E'\nRisposta attuale: ' || CASE WHEN g.stato = 'forse' THEN 'forse' ELSE 'nessuna' END
           || E'\nAzione: indicare presente, assente o in ritardo',
         g.evento_id
  FROM nuovi n
  JOIN da_generare g ON g.giocatore_id = n.giocatore_id AND g.evento_id = n.evento_id
  ON CONFLICT (giocatore_id, evento_id, tipo) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.genera_solleciti_presenze()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.genera_solleciti_presenze_fascia('sollecita_presenze_24h', interval '12 hours', interval '24 hours');
  PERFORM public.genera_solleciti_presenze_fascia('sollecita_presenze_12h', interval '6 hours', interval '12 hours');
  PERFORM public.genera_solleciti_presenze_fascia('sollecita_presenze_6h', interval '0', interval '6 hours');
END;
$$;

-- Come gli altri job di M17: solo il proprietario (pg_cron) e la service role li eseguono.
REVOKE ALL ON FUNCTION public.inizio_evento(date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.genera_avvisi_palloni_fascia(text, interval, interval)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.genera_revoche_palloni() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.genera_avvisi_palloni() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.genera_solleciti_presenze_fascia(text, interval, interval)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.genera_solleciti_presenze() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.inizio_evento(date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.genera_avvisi_palloni_fascia(text, interval, interval)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.genera_revoche_palloni() TO service_role;
GRANT EXECUTE ON FUNCTION public.genera_avvisi_palloni() TO service_role;
GRANT EXECUTE ON FUNCTION public.genera_solleciti_presenze_fascia(text, interval, interval)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.genera_solleciti_presenze() TO service_role;

SELECT cron.schedule(
  'avvisi-palloni-automatici',
  '*/15 * * * *',
  $$ SELECT public.genera_avvisi_palloni() $$
);

SELECT cron.schedule(
  'solleciti-presenze-automatici',
  '*/15 * * * *',
  $$ SELECT public.genera_solleciti_presenze() $$
);

-- --- Push: anche le notifiche automatiche di palloni e solleciti -------------------------------
--
-- Nascono nel database come i promemoria: nessuna route le manda, quindi la push passa dalla coda
-- (DD-038). Gli avvisi dei pulsanti (`turno_palloni`, `sollecita_presenze`) restano fuori: la push
-- la manda già la route e una seconda sarebbe un doppione.

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
    'sollecita_presenze_6h'
  ))
  EXECUTE FUNCTION public.accoda_push_promemoria();

-- --- Email: il turno palloni non ne manda ------------------------------------------------------
--
-- Stessa funzione di M22, con un'uscita anticipata per i tipi dei palloni (automatici, revoca e
-- pulsante). L'`upsert` del pulsante riscrive `creato_il` e fa scattare il trigger: anche quel
-- caso esce senza accodare nulla.

CREATE OR REPLACE FUNCTION public.accoda_notifica_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo IN (
    'turno_palloni',
    'turno_palloni_12h',
    'turno_palloni_6h',
    'turno_palloni_3h',
    'turno_palloni_revocato'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifiche_email_coda (notifica_id)
  VALUES (NEW.id)
  ON CONFLICT (notifica_id) DO UPDATE
    SET stato = 'in_coda',
        tentativi = 0,
        prossimo_tentativo = now(),
        errore = NULL,
        inviata_il = NULL,
        aggiornata_il = now();
  RETURN NEW;
END;
$$;

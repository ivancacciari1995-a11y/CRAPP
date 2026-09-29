-- M24 — Tre canali per ogni notifica: push dei promemoria e sondaggio in-app/email (DD-038)
--
-- Due lacune rispetto al requisito «ogni notifica arriva per push, in-app ed email»:
--
--   1. I promemoria a 24 e 3 ore nascono nel database (job pg_cron, M17), che non può firmare né
--      cifrare una push Web: arrivavano solo in-app e per email. Qui si accodano in
--      `notifiche_push_coda`; la push la manda il worker `mailer/`, con lo stesso modulo
--      dell'app (`src/lib/webpush.server.ts`).
--   2. Il sondaggio pre-partita partiva solo come push. La route `apri-sondaggio` ora scrive anche
--      `notifiche_utente` (tipo nuovo `sondaggio_cacche`): compare nel centro notifiche e la
--      mail parte dal trigger di M22. Serve solo estendere il vincolo CHECK sul tipo.
--
-- Come per le email (M22), la coda è una tabella a parte con RLS senza policy: la policy UPDATE
-- del giocatore su `notifiche_utente` gli permetterebbe di riportare a 'in_coda' una push già
-- partita. Solo la service role (il worker) la legge e la scrive.

-- --- Tipo `sondaggio_cacche` -------------------------------------------------------------------

ALTER TABLE public.notifiche_utente DROP CONSTRAINT notifiche_utente_tipo_check;
ALTER TABLE public.notifiche_utente ADD CONSTRAINT notifiche_utente_tipo_check CHECK (
  tipo IN (
    'admin',
    'evento_promemoria_24h',
    'evento_promemoria_3h',
    'turno_palloni',
    'sollecita_presenze',
    'sondaggio_cacche'
  )
);

-- --- Coda delle push dei promemoria ------------------------------------------------------------

CREATE TABLE public.notifiche_push_coda (
  notifica_id uuid PRIMARY KEY REFERENCES public.notifiche_utente(id) ON DELETE CASCADE,
  stato text NOT NULL DEFAULT 'in_coda'
    CHECK (stato IN ('in_coda', 'in_invio', 'inviata', 'fallita', 'saltata')),
  tentativi integer NOT NULL DEFAULT 0,
  prossimo_tentativo timestamptz NOT NULL DEFAULT now(),
  errore text,
  inviata_il timestamptz,
  aggiornata_il timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifiche_push_coda IS
  'Coda delle push per i promemoria evento (M24): una riga per notifica, scritta dal trigger e dal worker. Le altre notifiche mandano la push dall''app.';

CREATE INDEX notifiche_push_coda_da_inviare_idx
  ON public.notifiche_push_coda (prossimo_tentativo)
  WHERE stato = 'in_coda';

ALTER TABLE public.notifiche_push_coda ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifiche_push_coda FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.notifiche_push_coda TO service_role;

-- Solo i promemoria: turno palloni, sollecito presenze, messaggio dello staff e sondaggio la push
-- la mandano già dall'app, e una seconda dal worker sarebbe un doppione. Le notifiche già
-- presenti alla migration non si accodano: il trigger non ha backfill.
CREATE OR REPLACE FUNCTION public.accoda_push_promemoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifiche_push_coda (notifica_id)
  VALUES (NEW.id)
  ON CONFLICT (notifica_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notifiche_utente_accoda_push_promemoria
  AFTER INSERT ON public.notifiche_utente
  FOR EACH ROW
  WHEN (NEW.tipo IN ('evento_promemoria_24h', 'evento_promemoria_3h'))
  EXECUTE FUNCTION public.accoda_push_promemoria();

-- --- RPC del worker ----------------------------------------------------------------------------

-- Prende fino a `p_max` push da spedire, le marca 'in_invio' e restituisce per ciascuna il testo e
-- le iscrizioni (dispositivi) del giocatore. `FOR UPDATE SKIP LOCKED`: due worker avviati per
-- errore non prendono mai la stessa riga. Prima ripulisce tre casi:
--   * righe ferme 'in_invio' da più di 10 minuti (worker morto a metà) tornano 'in_coda';
--   * promemoria creati da più di 3 ore diventano 'saltata': una push arrivata a evento iniziato
--     è solo rumore (worker fermo a lungo);
--   * giocatori senza nessun dispositivo iscritto diventano 'saltata', senza errore.
CREATE OR REPLACE FUNCTION public.prendi_push_promemoria(p_max integer DEFAULT 20)
RETURNS TABLE (
  id_notifica uuid,
  oggetto text,
  testo text,
  tentativi_fatti integer,
  iscrizioni jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifiche_push_coda c
     SET stato = 'in_coda', aggiornata_il = now()
   WHERE c.stato = 'in_invio'
     AND c.aggiornata_il < now() - interval '10 minutes';

  UPDATE public.notifiche_push_coda c
     SET stato = 'saltata', aggiornata_il = now()
    FROM public.notifiche_utente n
   WHERE c.notifica_id = n.id
     AND c.stato = 'in_coda'
     AND c.prossimo_tentativo <= now()
     AND (
       n.creato_il < now() - interval '3 hours'
       OR NOT EXISTS (
         SELECT 1 FROM public.push_subscriptions s WHERE s.giocatore_id = n.giocatore_id
       )
     );

  RETURN QUERY
  WITH scelte AS (
    SELECT c.notifica_id
      FROM public.notifiche_push_coda c
     WHERE c.stato = 'in_coda' AND c.prossimo_tentativo <= now()
     ORDER BY c.prossimo_tentativo
     LIMIT greatest(p_max, 0)
       FOR UPDATE SKIP LOCKED
  ),
  presi AS (
    UPDATE public.notifiche_push_coda c
       SET stato = 'in_invio', aggiornata_il = now()
      FROM scelte s
     WHERE c.notifica_id = s.notifica_id
    RETURNING c.notifica_id, c.tentativi
  )
  SELECT p.notifica_id,
         n.titolo,
         n.corpo,
         p.tentativi,
         coalesce(
           (SELECT jsonb_agg(jsonb_build_object(
                     'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
              FROM public.push_subscriptions s
             WHERE s.giocatore_id = n.giocatore_id),
           '[]'::jsonb
         )
    FROM presi p
    JOIN public.notifiche_utente n ON n.id = p.notifica_id
   ORDER BY n.creato_il;
END;
$$;

-- Registra l'esito. Agisce solo su righe 'in_invio', così un esito in ritardo non ne sovrascrive
-- uno già deciso.
--   'inviata' → almeno un dispositivo ha accettato la push
--   'riprova' → errore temporaneo, torna in coda dopo `p_prossimo`, conta un tentativo
--   'fallita' → definitiva (rifiuto permanente o tentativi finiti)
--   'saltata' → nessun dispositivo utile (tutte le iscrizioni erano scadute)
CREATE OR REPLACE FUNCTION public.esito_push_promemoria(
  p_id uuid,
  p_esito text,
  p_errore text DEFAULT NULL,
  p_prossimo timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_esito NOT IN ('inviata', 'riprova', 'fallita', 'saltata') THEN
    RAISE EXCEPTION 'esito non valido: %', p_esito;
  END IF;

  UPDATE public.notifiche_push_coda c
     SET stato = CASE p_esito
                   WHEN 'riprova' THEN 'in_coda'
                   ELSE p_esito
                 END,
         tentativi = c.tentativi + CASE WHEN p_esito IN ('riprova', 'fallita') THEN 1 ELSE 0 END,
         prossimo_tentativo = CASE
                                WHEN p_esito = 'riprova' THEN coalesce(p_prossimo, now())
                                ELSE c.prossimo_tentativo
                              END,
         errore = CASE WHEN p_esito = 'inviata' THEN NULL ELSE left(p_errore, 500) END,
         inviata_il = CASE WHEN p_esito = 'inviata' THEN now() ELSE c.inviata_il END,
         aggiornata_il = now()
   WHERE c.notifica_id = p_id AND c.stato = 'in_invio';
END;
$$;

REVOKE ALL ON FUNCTION public.accoda_push_promemoria() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prendi_push_promemoria(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.esito_push_promemoria(uuid, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.prendi_push_promemoria(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.esito_push_promemoria(uuid, text, text, timestamptz)
  TO service_role;

-- M22 — Notifiche email (DD-036)
--
-- Ogni riga di `notifiche_utente` diventa anche una mail, spedita da un worker Docker esterno
-- a Supabase (cartella `mailer/`) che interroga il database e invia via SMTP. Nessuna sorgente
-- di M17 cambia: un trigger accoda le notifiche NUOVE, quelle già presenti non vengono mai
-- inviate (il trigger non ha un backfill).
--
-- Tre pezzi:
--   1. `notifiche_email_coda`: stato d'invio di ogni notifica. Tabella a parte, con RLS senza
--      alcuna policy: la policy UPDATE di `notifiche_utente` lascerebbe a un client la
--      possibilità di riportare a 'in_coda' una mail già partita. Solo la service role (il
--      worker) la legge e la scrive.
--   2. `preferenze_utente`: interruttore «Email» per ACCOUNT (non per slot giocatore).
--      Nessuna riga = mail attive; la riga nasce quando il giocatore tocca l'interruttore.
--   3. Tre funzioni RPC riservate alla service role, con cui il worker prende un lotto,
--      registra l'esito e conta le mail delle ultime 24 ore (tetto giornaliero di Gmail).

-- --- Coda ------------------------------------------------------------------------------------

CREATE TABLE public.notifiche_email_coda (
  notifica_id uuid PRIMARY KEY REFERENCES public.notifiche_utente(id) ON DELETE CASCADE,
  stato text NOT NULL DEFAULT 'in_coda'
    CHECK (stato IN ('in_coda', 'in_invio', 'inviata', 'fallita', 'saltata')),
  tentativi integer NOT NULL DEFAULT 0,
  prossimo_tentativo timestamptz NOT NULL DEFAULT now(),
  errore text,
  inviata_il timestamptz,
  aggiornata_il timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifiche_email_coda IS
  'Coda delle mail per le notifiche in-app (M22): una riga per notifica, scritta solo dal trigger e dal worker.';

CREATE INDEX notifiche_email_coda_da_inviare_idx
  ON public.notifiche_email_coda (prossimo_tentativo)
  WHERE stato = 'in_coda';

CREATE INDEX notifiche_email_coda_inviate_idx
  ON public.notifiche_email_coda (inviata_il)
  WHERE stato = 'inviata';

ALTER TABLE public.notifiche_email_coda ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifiche_email_coda FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.notifiche_email_coda TO service_role;

-- --- Preferenze per account ------------------------------------------------------------------

CREATE TABLE public.preferenze_utente (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifiche boolean NOT NULL DEFAULT true,
  aggiornata_il timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.preferenze_utente IS
  'Preferenze del singolo account (non dello slot giocatore). Nessuna riga = valori di default.';

REVOKE ALL ON public.preferenze_utente FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.preferenze_utente TO authenticated;
GRANT ALL ON public.preferenze_utente TO service_role;

ALTER TABLE public.preferenze_utente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "L'utente legge le proprie preferenze" ON public.preferenze_utente
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "L'utente crea le proprie preferenze" ON public.preferenze_utente
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "L'utente aggiorna le proprie preferenze" ON public.preferenze_utente
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- --- Trigger: ogni notifica nuova (o rinviata) finisce in coda ---------------------------------
--
-- `UPDATE OF creato_il` intercetta l'`upsert` di turno palloni e sollecito presenze, che
-- riscrive `creato_il`: è un rinvio voluto (testo fresco, `letta` a false) e rimette in coda
-- anche la mail. "Segna come letta" e l'ON CONFLICT DO NOTHING dei cron non toccano quella
-- colonna e non accodano nulla.

CREATE OR REPLACE FUNCTION public.accoda_notifica_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

CREATE TRIGGER notifiche_utente_accoda_email
  AFTER INSERT OR UPDATE OF creato_il ON public.notifiche_utente
  FOR EACH ROW EXECUTE FUNCTION public.accoda_notifica_email();

-- --- RPC del worker ----------------------------------------------------------------------------

-- Prende fino a `p_max` mail da spedire e le marca 'in_invio'. `FOR UPDATE SKIP LOCKED`: due
-- worker avviati per errore non prendono mai la stessa riga. Prima ripulisce due casi:
--   * righe rimaste 'in_invio' da più di 10 minuti (worker morto a metà invio) tornano 'in_coda';
--   * righe senza destinatario (slot non collegato a un account, email assente, preferenza
--     spenta) diventano 'saltata', senza errore.
-- L'indirizzo è `giocatori_squadra.email`, la stessa che collega account e giocatore (DD-018).
CREATE OR REPLACE FUNCTION public.prendi_notifiche_email(p_max integer DEFAULT 20)
RETURNS TABLE (
  id_notifica uuid,
  destinatario text,
  oggetto text,
  testo text,
  id_evento text,
  tipo_notifica text,
  tentativi_fatti integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifiche_email_coda c
     SET stato = 'in_coda', aggiornata_il = now()
   WHERE c.stato = 'in_invio'
     AND c.aggiornata_il < now() - interval '10 minutes';

  UPDATE public.notifiche_email_coda c
     SET stato = 'saltata', aggiornata_il = now()
    FROM public.notifiche_utente n
    JOIN public.giocatori_squadra g ON g.id = n.giocatore_id
   WHERE c.notifica_id = n.id
     AND c.stato = 'in_coda'
     AND c.prossimo_tentativo <= now()
     AND (
       g.auth_user_id IS NULL
       OR coalesce(btrim(g.email), '') = ''
       OR EXISTS (
         SELECT 1 FROM public.preferenze_utente p
         WHERE p.auth_user_id = g.auth_user_id AND NOT p.email_notifiche
       )
     );

  RETURN QUERY
  WITH scelte AS (
    SELECT c.notifica_id
      FROM public.notifiche_email_coda c
     WHERE c.stato = 'in_coda' AND c.prossimo_tentativo <= now()
     ORDER BY c.prossimo_tentativo
     LIMIT greatest(p_max, 0)
       FOR UPDATE SKIP LOCKED
  ),
  presi AS (
    UPDATE public.notifiche_email_coda c
       SET stato = 'in_invio', aggiornata_il = now()
      FROM scelte s
     WHERE c.notifica_id = s.notifica_id
    RETURNING c.notifica_id, c.tentativi
  )
  SELECT p.notifica_id, g.email, n.titolo, n.corpo, n.evento_id, n.tipo, p.tentativi
    FROM presi p
    JOIN public.notifiche_utente n ON n.id = p.notifica_id
    JOIN public.giocatori_squadra g ON g.id = n.giocatore_id
   ORDER BY n.creato_il;
END;
$$;

-- Registra l'esito di un invio. Agisce solo su righe 'in_invio', così un esito in ritardo o
-- ripetuto non sovrascrive uno stato già deciso.
--   'inviata'  → stato inviata
--   'riprova'  → torna in coda dopo `p_prossimo`, conta un tentativo
--   'differita'→ torna in coda dopo `p_prossimo`, NON conta un tentativo (limite giornaliero
--                di Gmail o configurazione SMTP da correggere: non è colpa della mail)
--   'fallita'  → definitiva
CREATE OR REPLACE FUNCTION public.esito_notifica_email(
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
  IF p_esito NOT IN ('inviata', 'riprova', 'differita', 'fallita') THEN
    RAISE EXCEPTION 'esito non valido: %', p_esito;
  END IF;

  UPDATE public.notifiche_email_coda c
     SET stato = CASE p_esito
                   WHEN 'inviata' THEN 'inviata'
                   WHEN 'fallita' THEN 'fallita'
                   ELSE 'in_coda'
                 END,
         tentativi = c.tentativi + CASE WHEN p_esito IN ('riprova', 'fallita') THEN 1 ELSE 0 END,
         prossimo_tentativo = CASE
                                WHEN p_esito IN ('riprova', 'differita')
                                  THEN coalesce(p_prossimo, now())
                                ELSE c.prossimo_tentativo
                              END,
         errore = CASE WHEN p_esito = 'inviata' THEN NULL ELSE left(p_errore, 500) END,
         inviata_il = CASE WHEN p_esito = 'inviata' THEN now() ELSE c.inviata_il END,
         aggiornata_il = now()
   WHERE c.notifica_id = p_id AND c.stato = 'in_invio';
END;
$$;

-- Mail inviate nelle ultime 24 ore: il worker la usa per restare sotto il tetto di Gmail.
CREATE OR REPLACE FUNCTION public.email_inviate_ultime_24h()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
    FROM public.notifiche_email_coda
   WHERE stato = 'inviata' AND inviata_il > now() - interval '24 hours';
$$;

REVOKE ALL ON FUNCTION public.accoda_notifica_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prendi_notifiche_email(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.esito_notifica_email(uuid, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_inviate_ultime_24h() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.prendi_notifiche_email(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.esito_notifica_email(uuid, text, text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.email_inviate_ultime_24h() TO service_role;

-- M37 — Voto MVP segreto, nome del votato dal database, votazione che si chiude (DD-052)
--
-- 1. Segretezza. Finora `mvp_voti` era leggibile da tutti, quindi chiunque vedeva chi aveva votato chi.
--    Ora la lettura diretta della tabella è del solo votante (il proprio voto) e degli admin (policy
--    M11, che servono per correggere un voto: dall'app non vedono chi ha votato chi). Tutti gli altri
--    leggono solo i conteggi, dalla vista `mvp_voti_anonimi`: una riga per voto, senza `votante_id`.
-- 2. Nome. `votato_nome` lo scriveva il client, quindi poteva non corrispondere a `votato_id`. Un trigger
--    lo riempie dalla rosa (`giocatori_squadra`) a partire da `votato_id`, ignorando quello inviato.
-- 3. Chiusura. Il voto si apre 2 ore dopo l'inizio della partita (M36) e si chiude 24 ore dopo
--    l'apertura. I valori sono gli stessi di ORE_ATTESA_MVP e DURATA_VOTO_MVP_ORE in
--    src/lib/mvp-voti.ts. Gli admin restano fuori da questo vincolo.

-- --- 1. Segretezza ------------------------------------------------------------------------------
DROP POLICY "Chiunque puo leggere i voti MVP" ON public.mvp_voti;

CREATE POLICY "Ognuno legge il proprio voto MVP" ON public.mvp_voti
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = votante_id AND g.auth_user_id = auth.uid()
    )
  );

-- La vista gira con i permessi del proprietario (security_invoker = false): è ciò che le permette di
-- leggere tutte le righe pur senza esporre il votante. L'ordine è per candidato, non per arrivo, così
-- la sequenza dei voti non rivela nulla.
CREATE VIEW public.mvp_voti_anonimi WITH (security_invoker = false) AS
  SELECT match_id, votato_id, votato_nome
  FROM public.mvp_voti
  ORDER BY match_id, votato_id;

REVOKE ALL ON public.mvp_voti_anonimi FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mvp_voti_anonimi TO authenticated;
GRANT ALL ON public.mvp_voti_anonimi TO service_role;

-- --- 2. Nome del votato dalla rosa ----------------------------------------------------------------
-- Se `votato_id` non è in rosa (id di prova) resta il nome ricevuto: non c'è niente da sostituire.
CREATE OR REPLACE FUNCTION public.mvp_voti_nome_dalla_rosa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  nome_rosa text;
BEGIN
  SELECT btrim(g.nome || ' ' || g.cognome) INTO nome_rosa
  FROM public.giocatori_squadra g
  WHERE g.id = NEW.votato_id;
  IF FOUND THEN
    NEW.votato_nome := nome_rosa;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mvp_voti_nome_dalla_rosa
  BEFORE INSERT OR UPDATE OF votato_id, votato_nome ON public.mvp_voti
  FOR EACH ROW
  EXECUTE FUNCTION public.mvp_voti_nome_dalla_rosa();

-- --- 3. Finestra di voto: apre a +2 ore, chiude 24 ore dopo l'apertura ------------------------------
CREATE OR REPLACE FUNCTION public.voto_mvp_consentito(
  p_match_id text, p_votante_id text, p_votato_id text
) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.evento_permette_voto(p_match_id, p_votante_id, p_votato_id, false)
  AND EXISTS (
    SELECT 1
    FROM public.eventi_app e
    CROSS JOIN LATERAL (
      SELECT ((e.data + CASE WHEN e.ora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                             THEN e.ora::time ELSE time '00:00' END)
                AT TIME ZONE 'Europe/Rome') AS inizio
    ) t
    WHERE e.id = p_match_id
      AND e.tipo = 'partita'
      AND t.inizio + interval '2 hours' <= now()
      AND now() < t.inizio + interval '2 hours' + interval '24 hours'
  )
  -- votante e votato sono diversi (mvp_no_autovoto): due righe = entrambi presenti
  AND (
    SELECT count(DISTINCT r.giocatore_id)
    FROM public.risposte_presenze r
    WHERE r.evento_id = p_match_id
      AND r.giocatore_id IN (p_votante_id, p_votato_id)
      AND r.stato IN ('presente', 'ritardo')
  ) = 2;
$$;

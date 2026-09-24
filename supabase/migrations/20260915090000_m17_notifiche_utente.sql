-- M17 — Centro notifiche in-app (badge non lette accanto al profilo)
--
-- Fino ad oggi le uniche notifiche erano push OS/browser (`push_subscriptions`, vedi
-- docs/modules/notifiche.md), senza storico né stato letto/non letto. Questa migration
-- aggiunge `notifiche_utente`: una riga per notifica, per giocatore, con un flag `letta`.
-- Quattro sorgenti generano righe, mai il client:
--
--   1. Messaggio libero dell'admin (`notifica-personalizzata.ts`, invariato lato push).
--   2. Promemoria automatico prima di un evento, 24h e 3h prima (due `cron.schedule`,
--      estensione `pg_cron` già abilitata dal 31/07/2026 e mai usata finora). Volutamente
--      non c'è una notifica sulla sola creazione dell'evento: conta l'avvicinarsi della
--      data, non il momento in cui è stato messo in calendario.
--   3. Turno palloni (`promemoria-palloni.ts`, avviato a mano da un admin dalla pagina
--      evento), in parallelo alla push.
--   4. Sollecito presenze (`sollecita-presenze.ts`, stesso innesco manuale), in parallelo
--      alla push.
--
-- I destinatari di un evento seguono la stessa convenzione di `convocatiEvento()`
-- (src/lib/eventi.ts) ed `evento_permette_voto()` (M13): `convocati` vuoto significa tutta
-- la rosa attiva, altrimenti solo gli id in `convocati`.

CREATE TABLE public.notifiche_utente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giocatore_id text NOT NULL REFERENCES public.giocatori_squadra(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (
    tipo IN (
      'admin',
      'evento_promemoria_24h',
      'evento_promemoria_3h',
      'turno_palloni',
      'sollecita_presenze'
    )
  ),
  titolo text NOT NULL,
  corpo text NOT NULL DEFAULT '',
  evento_id text REFERENCES public.eventi_app(id) ON DELETE CASCADE,
  letta boolean NOT NULL DEFAULT false,
  creato_il timestamptz NOT NULL DEFAULT now(),
  -- Per tipo='admin' evento_id è NULL: NULL non è mai uguale a NULL, quindi la UNIQUE non
  -- si applica e ogni messaggio admin resta una riga separata (corretto). Per i tipi legati
  -- a un evento, un secondo invio (cron che gira di nuovo, admin che preme di nuovo il
  -- pulsante) aggiorna la stessa riga invece di duplicarla — vedi gli `upsert` sotto.
  UNIQUE (giocatore_id, evento_id, tipo)
);

COMMENT ON TABLE public.notifiche_utente IS
  'Centro notifiche in-app per giocatore: messaggi admin, promemoria evento, turno palloni, sollecito presenze.';

CREATE INDEX notifiche_utente_giocatore_letta_idx
  ON public.notifiche_utente (giocatore_id, letta);

GRANT SELECT, UPDATE, DELETE ON public.notifiche_utente TO authenticated;
GRANT ALL ON public.notifiche_utente TO service_role;

ALTER TABLE public.notifiche_utente ENABLE ROW LEVEL SECURITY;

-- Un account può essere collegato a più slot giocatore (`giocatori_squadra.auth_user_id`):
-- vede le notifiche di tutti i suoi slot, il client filtra per il giocatore selezionato in
-- localStorage (stesso pattern di `LinkProfilo`/`useGiocatoreId`).
CREATE POLICY "Il giocatore legge le proprie notifiche" ON public.notifiche_utente
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = notifiche_utente.giocatore_id AND g.auth_user_id = auth.uid()
    )
  );

-- Solo per segnarle come lette: nessuna policy INSERT per authenticated, le righe nascono
-- solo da funzioni `SECURITY DEFINER` o dalla service role (route admin).
CREATE POLICY "Il giocatore segna le proprie notifiche come lette" ON public.notifiche_utente
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = notifiche_utente.giocatore_id AND g.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = notifiche_utente.giocatore_id AND g.auth_user_id = auth.uid()
    )
  );

-- Eliminazione (swipe o pulsante nel pannello): non c'è pulizia automatica delle notifiche
-- vecchie, quindi è l'unico modo per un giocatore di toglierle di mezzo per sempre.
CREATE POLICY "Il giocatore elimina le proprie notifiche" ON public.notifiche_utente
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.giocatori_squadra g
      WHERE g.id = notifiche_utente.giocatore_id AND g.auth_user_id = auth.uid()
    )
  );

-- --- Destinatari di un evento: stessa convenzione di convocatiEvento()/evento_permette_voto() ---

CREATE OR REPLACE FUNCTION public.giocatori_destinatari_evento(p_evento_id text)
RETURNS SETOF text
LANGUAGE sql STABLE AS $$
  SELECT g.id
  FROM public.eventi_app e
  JOIN public.giocatori_squadra g
    ON g.attivo = true
   AND (cardinality(e.convocati) = 0 OR g.id = ANY(e.convocati))
  WHERE e.id = p_evento_id;
$$;

-- --- Promemoria evento imminente (pg_cron) -----------------------------------------------
--
-- `data`/`ora` sono salvate come ora locale Italia (stessa convenzione di
-- `m10_azzera_turni_palloni_allenamenti`), quindi il confronto con `now()` (timestamptz)
-- passa esplicitamente da `AT TIME ZONE 'Europe/Rome'`.
--
-- `eventi_app.ora` è testo libero (`<input type="time">` lato client, ma la form non
-- impedisce di svuotarlo, vedi `src/routes/eventi.tsx`): un `::time` diretto su un valore
-- non valido manda in errore l'intera istruzione, e con essa **tutti** i promemoria di
-- quel giro di cron, non solo quelli dell'evento incriminato. `ora_evento_a_time()` assorbe
-- l'errore riga per riga: un evento con l'ora scritta male viene solo escluso.

CREATE OR REPLACE FUNCTION public.ora_evento_a_time(p_ora text)
RETURNS time
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN p_ora::time;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.genera_promemoria_eventi(p_tipo text, p_finestra interval)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifiche_utente (giocatore_id, tipo, titolo, corpo, evento_id)
  SELECT d, p_tipo, 'Promemoria: ' || e.titolo,
         to_char(e.data, 'DD/MM/YYYY') || ' alle ' || e.ora,
         e.id
  FROM public.eventi_app e
  CROSS JOIN LATERAL public.giocatori_destinatari_evento(e.id) AS d
  WHERE public.ora_evento_a_time(e.ora) IS NOT NULL
    AND ((e.data + public.ora_evento_a_time(e.ora)) AT TIME ZONE 'Europe/Rome') - now()
        BETWEEN interval '0' AND p_finestra
  ON CONFLICT (giocatore_id, evento_id, tipo) DO NOTHING;
END;
$$;

SELECT cron.schedule(
  'promemoria-eventi-24h',
  '0 * * * *',
  $$ SELECT public.genera_promemoria_eventi('evento_promemoria_24h', interval '24 hours') $$
);

SELECT cron.schedule(
  'promemoria-eventi-3h',
  '*/15 * * * *',
  $$ SELECT public.genera_promemoria_eventi('evento_promemoria_3h', interval '3 hours') $$
);

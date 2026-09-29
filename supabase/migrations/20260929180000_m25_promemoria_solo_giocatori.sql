-- M25 — L'allenatore non riceve i promemoria degli eventi (DD-039)
--
-- La migration M21 (DD-034) aggiunse `g.tipo = 'allenatore'` ai destinatari dei promemoria a 24 e
-- 3 ore: l'allenatore attivo li riceveva sempre, convocato o no. Ma un promemoria chiede di
-- esserci, e l'allenatore non può rispondere alle presenze, non è convocabile e non compare tra i
-- partecipanti: per un evento come la cena di squadra riceveva un avviso su cui non poteva fare
-- nulla. Da ora i destinatari sono solo i giocatori attivi: i convocati, o tutta la rosa se
-- `convocati` è vuoto.
--
-- Cambia solo questa funzione: `genera_promemoria_eventi()` (M17, M23), i job pg_cron, le code
-- email e push e il resto delle notifiche restano invariati. I promemoria già generati per un
-- allenatore prima della migration non vengono toccati. I messaggi dello staff continuano ad
-- arrivargli: non dipendono da questa funzione.

CREATE OR REPLACE FUNCTION public.giocatori_destinatari_evento(p_evento_id text)
RETURNS SETOF text
LANGUAGE sql STABLE AS $$
  SELECT g.id
  FROM public.eventi_app e
  JOIN public.giocatori_squadra g
    ON g.attivo = true
   AND g.tipo = 'giocatore'
   AND (cardinality(e.convocati) = 0 OR g.id = ANY(e.convocati))
  WHERE e.id = p_evento_id;
$$;

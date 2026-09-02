-- M4 — Chiusura degli accessi anonimi alle tabelle v1.0 (DD-011).
--
-- Da applicare SOLO quando tutti hanno collegato l'account Google: da qui in poi il
-- ruolo `anon` non legge né scrive più nulla, quindi chi non ha fatto login vede l'app
-- vuota. Le route in `src/routes/api/public/` usano la service role e non sono toccate.
--
-- Le policy restano dichiarate `TO anon, authenticated`: senza GRANT il ruolo anon non
-- arriva comunque alla tabella, e le policy continuano a valere per gli autenticati.

REVOKE ALL ON public.turni_palloni        FROM anon;
REVOKE ALL ON public.push_subscriptions   FROM anon;
REVOKE ALL ON public.badge_social_voti    FROM anon;
REVOKE ALL ON public.scout_sessioni       FROM anon;
REVOKE ALL ON public.scout_live           FROM anon;
REVOKE ALL ON public.mvp_voti             FROM anon;
REVOKE ALL ON public.risposte_presenze    FROM anon;
REVOKE ALL ON public.eventi_app           FROM anon;
REVOKE ALL ON public.pagelle_voti         FROM anon;
REVOKE ALL ON public.cacche_partita       FROM anon;

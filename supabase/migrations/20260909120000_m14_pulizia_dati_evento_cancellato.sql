-- M14 — Pulizia a cascata dei dati collegati quando un evento viene cancellato
--
-- Un audit del modulo Obiettivi ha verificato che gli obiettivi in sé non hanno bisogno di
-- nessuna pulizia: sono ricalcolati a runtime sull'elenco eventi corrente (`obiettivi.ts`), e
-- un evento cancellato semplicemente sparisce da quell'elenco. Il problema è un livello sotto:
-- `useEliminaEvento()` (`src/lib/eventi.ts`) cancella solo la riga in `eventi_app`, lasciando
-- orfane le righe collegate in `risposte_presenze`, `cacche_partita`, `mvp_voti`,
-- `pagelle_voti`, `badge_social_voti`, `turni_palloni`, `scout_sessioni`, `scout_live` e
-- `scout_partite` — nessuna di queste ha mai avuto una foreign key verso `eventi_app(id)`.
--
-- Una FK con ON DELETE CASCADE non è applicabile oggi: `mvp.md` documenta che storicamente
-- `match_id` in `mvp_voti`/`pagelle_voti`/`badge_social_voti` a volte conteneva l'id di una
-- sessione Scout o di una partita CSI, non l'id evento CrAPP — un vincolo FK rifiuterebbe la
-- migration alla prima riga storica disallineata. Un trigger non valida i dati esistenti,
-- solo le cancellazioni da qui in avanti, quindi è applicabile senza bonificare prima lo
-- storico (bonifica che resta un lavoro separato, se mai servirà).
--
-- SECURITY DEFINER: le policy DELETE di alcune tabelle collegate potrebbero in futuro
-- restringersi (oggi sono tutte aperte, DD-023); il trigger deve continuare a pulire a
-- prescindere da chi ha eseguito la DELETE su eventi_app.

CREATE OR REPLACE FUNCTION public.pulisci_dati_evento_cancellato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.risposte_presenze WHERE evento_id = OLD.id;
  DELETE FROM public.cacche_partita    WHERE evento_id = OLD.id;
  DELETE FROM public.mvp_voti          WHERE match_id  = OLD.id;
  DELETE FROM public.pagelle_voti      WHERE match_id  = OLD.id;
  DELETE FROM public.badge_social_voti WHERE match_id  = OLD.id;
  DELETE FROM public.turni_palloni     WHERE evento_id = OLD.id;
  DELETE FROM public.scout_sessioni    WHERE evento_id = OLD.id;
  DELETE FROM public.scout_live        WHERE evento_id = OLD.id;
  DELETE FROM public.scout_partite     WHERE evento_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER eventi_app_pulisci_dati_collegati
  AFTER DELETE ON public.eventi_app
  FOR EACH ROW EXECUTE FUNCTION public.pulisci_dati_evento_cancellato();

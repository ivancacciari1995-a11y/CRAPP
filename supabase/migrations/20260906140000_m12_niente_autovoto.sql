-- M12 — Nessuno si vota da solo, nemmeno parlando con PostgREST.
--
-- `pagelle_voti` ha il vincolo `pagelle_no_autovoto` fin dalla v1.0. Le altre due votazioni
-- no: l'MVP non escludeva l'auto-voto nemmeno in interfaccia (bastava toccare il proprio
-- nome nell'elenco), i badge social lo escludevano solo lì. M11 (DD-023) garantisce che il
-- voto sia firmato con il proprio `votante_id`, ma non dice niente su chi viene votato:
-- eleggersi MVP da soli restava a un POST di distanza, e il titolo finiva in
-- `mvpVintiPerGiocatore()` come qualsiasi altro.
--
-- Le righe già esistenti che violano la regola vanno cancellate prima del vincolo,
-- altrimenti l'ALTER fallisce: sono voti che non sarebbero mai dovuti esistere, non dati da
-- conservare. In locale non ce n'era nessuna.

DELETE FROM public.mvp_voti          WHERE votante_id = votato_id;
DELETE FROM public.badge_social_voti WHERE votante_id = votato_id;

ALTER TABLE public.mvp_voti
  ADD CONSTRAINT mvp_no_autovoto CHECK (votante_id <> votato_id);

ALTER TABLE public.badge_social_voti
  ADD CONSTRAINT badge_social_no_autovoto CHECK (votante_id <> votato_id);

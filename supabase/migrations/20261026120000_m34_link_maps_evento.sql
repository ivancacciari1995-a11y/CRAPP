-- M34 — Link Google Maps del luogo di un evento
--
-- Colonna facoltativa: NULL = nessun link. Il CHECK accetta solo URL https di Google Maps (stesso
-- criterio di `linkMapsValido()` in src/lib/eventi.ts), perché il link è mostrato a tutta la squadra
-- come pulsante. Chi lo scrive è già limitato ad admin e allenatori dalle policy di `eventi_app` (M11).

ALTER TABLE public.eventi_app
  ADD COLUMN link_maps text,
  ADD CONSTRAINT eventi_app_link_maps_google
    CHECK (
      link_maps IS NULL
      OR (
        length(link_maps) <= 500
        AND link_maps ~ '^https://(maps\.app\.goo\.gl/|goo\.gl/maps/|maps\.google\.[a-z.]+/|(www\.)?google\.[a-z.]+/maps)\S*$'
      )
    );

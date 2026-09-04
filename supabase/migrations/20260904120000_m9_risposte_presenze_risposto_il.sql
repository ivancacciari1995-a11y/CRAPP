-- M9 — Istante della prima risposta alla convocazione (serie "Conferme 24h")
--
-- La serie "Conferme 24h" del modulo Serie di presenze richiede di sapere quanto tempo
-- passa fra la convocazione e la risposta del giocatore. Il primo dato c'è già
-- (`eventi_app.creato_il`), il secondo no: `risposte_presenze.aggiornato_il` registra
-- l'ULTIMA modifica, quindi un giocatore che risponde subito e poi cambia idea dopo una
-- settimana risulterebbe lento. Serve un istante separato, scritto una volta sola.
--
-- Non è un dato ricostruibile a posteriori: chi risponde prima che questa colonna esista
-- non lascia traccia. Le righe già presenti ereditano `aggiornato_il` come miglior
-- approssimazione disponibile.

ALTER TABLE public.risposte_presenze
  ADD COLUMN risposto_il timestamptz NOT NULL DEFAULT now();

UPDATE public.risposte_presenze SET risposto_il = aggiornato_il;

COMMENT ON COLUMN public.risposte_presenze.risposto_il IS
  'Istante della PRIMA risposta del giocatore per questo evento: non cambia se poi cambia stato. Si confronta con eventi_app.creato_il per la serie "Conferme 24h".';

-- Il client fa upsert senza questa colonna, quindi un aggiornamento non la tocca. Il
-- trigger difende comunque il valore originale da qualsiasi altra scrittura.
CREATE OR REPLACE FUNCTION public.blocca_risposto_il()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.risposto_il := OLD.risposto_il;
  RETURN NEW;
END;
$$;

CREATE TRIGGER risposte_presenze_risposto_il_immutabile
  BEFORE UPDATE ON public.risposte_presenze
  FOR EACH ROW EXECUTE FUNCTION public.blocca_risposto_il();

-- M27 — Turno palloni: un solo avviso, 3 ore prima dell'evento (DD-042)
--
-- Con M26 il job mandava l'avviso a 12, 6 e 3 ore. Ne basta uno, 3 ore prima, a chi deve portare
-- i palloni e a chi li deve prendere. Cambia solo il job: i tipi `turno_palloni_12h` e `_6h`
-- restano ammessi dai CHECK perché esistono notifiche e righe di registro già generate (anche la
-- revoca le guarda), ma non ne nascono di nuove. Le funzioni `genera_avvisi_palloni_fascia` e
-- `genera_revoche_palloni` non cambiano.

CREATE OR REPLACE FUNCTION public.genera_avvisi_palloni()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.genera_avvisi_palloni_fascia('turno_palloni_3h', interval '0', interval '3 hours');
  PERFORM public.genera_revoche_palloni();
END;
$$;

REVOKE ALL ON FUNCTION public.genera_avvisi_palloni() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.genera_avvisi_palloni() TO service_role;

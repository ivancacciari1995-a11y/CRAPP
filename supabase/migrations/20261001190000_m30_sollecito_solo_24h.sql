-- M30 — Sollecito presenze: un solo avviso automatico, 24 ore prima (DD-045)
--
-- Con M26 il job mandava il sollecito a 24, 12 e 6 ore. Ne basta uno, 24 ore prima: parte per gli
-- eventi che iniziano entro 24 ore (quindi anche per uno creato più tardi), a chi in quel momento
-- non ha risposto o ha risposto «forse». I tipi `sollecita_presenze_12h` e `_6h` restano ammessi dai
-- CHECK per le notifiche già generate, ma non ne nascono di nuove. Il pulsante manuale non cambia.

CREATE OR REPLACE FUNCTION public.genera_solleciti_presenze()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.genera_solleciti_presenze_fascia('sollecita_presenze_24h', interval '0', interval '24 hours');
END;
$$;

REVOKE ALL ON FUNCTION public.genera_solleciti_presenze() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.genera_solleciti_presenze() TO service_role;

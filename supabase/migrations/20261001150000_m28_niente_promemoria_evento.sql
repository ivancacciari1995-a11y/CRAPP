-- M28 — Niente più promemoria automatico a 24 e 3 ore prima degli eventi (DD-043)
--
-- Si tolgono solo i due job `pg_cron` di M17: da ora il database non genera più notifiche
-- `evento_promemoria_24h` e `evento_promemoria_3h`. La funzione `genera_promemoria_eventi()`, i tipi
-- ammessi dai CHECK e il registro `promemoria_eventi_generati` restano: servono per le notifiche
-- già generate e, volendo, per rimettere in funzione il promemoria con un solo `cron.schedule`.

DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN ('promemoria-eventi-24h', 'promemoria-eventi-3h');
END;
$$;

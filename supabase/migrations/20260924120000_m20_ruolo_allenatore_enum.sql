-- M20 — Nuovo valore `allenatore` per `app_role` (DD-034).
--
-- Sta da solo perché Postgres non permette di usare un valore di enum nella stessa
-- transazione che lo aggiunge: le policy e le funzioni che lo citano stanno in M21.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'allenatore';

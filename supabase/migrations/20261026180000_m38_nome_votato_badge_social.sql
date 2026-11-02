-- M38 — Anche i badge social prendono il nome del votato dalla rosa (DD-052)
--
-- Stesso difetto dell'MVP (M37): `badge_social_voti.votato_nome` lo scrive il client, quindi può non
-- corrispondere a `votato_id`, e l'app lo mostra («Hai votato …», elenco dei più votati). Si riusa il
-- trigger della M37: le due tabelle hanno le stesse colonne `votato_id` e `votato_nome`.
-- Le pagelle non hanno un nome del votato, quindi non serve altro.

CREATE TRIGGER badge_social_voti_nome_dalla_rosa
  BEFORE INSERT OR UPDATE OF votato_id, votato_nome ON public.badge_social_voti
  FOR EACH ROW
  EXECUTE FUNCTION public.mvp_voti_nome_dalla_rosa();

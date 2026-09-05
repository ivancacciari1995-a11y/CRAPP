-- M10: gli allenamenti non devono più avere turni palloni pre-assegnati.
-- La proposta automatica lato app non li riempie più; qui si azzerano eventuali
-- eventuali già salvati su allenamenti da oggi in poi, così restano «da assegnare».

DELETE FROM public.turni_palloni AS t
USING public.eventi_app AS e
WHERE t.evento_id = e.id
  AND e.tipo = 'allenamento'
  AND e.data >= (CURRENT_DATE AT TIME ZONE 'Europe/Rome')::date;

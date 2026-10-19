import { eventoVisibile, useEventi } from "./eventi";
import { usePuoGestireEventi } from "./ruoli";
import { useGiocatoreId } from "./user-store";

/** Gli eventi che l'utente corrente può vedere (calendario, home, elenco). */
export function useEventiVisibili() {
  const { eventi, ...resto } = useEventi();
  const giocatoreId = useGiocatoreId();
  const vedeTutto = usePuoGestireEventi();
  return {
    ...resto,
    eventi: eventi.filter((e) => eventoVisibile(e, giocatoreId, vedeTutto)),
  };
}

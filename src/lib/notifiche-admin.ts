import { useQuery } from "@tanstack/react-query";
import { intestazioniAutenticate } from "./auth";

const NOTIFICHE_ATTIVE_KEY = ["notifiche-attive"] as const;

async function fetchNotificheAttive(): Promise<Set<string>> {
  const res = await fetch("/api/public/notifiche-attive", {
    headers: await intestazioniAutenticate(),
  });
  if (!res.ok) throw new Error("Impossibile leggere le notifiche attive");
  const { giocatoreIds } = (await res.json()) as { giocatoreIds: string[] };
  return new Set(giocatoreIds);
}

/** Insieme degli id giocatore con almeno un dispositivo iscritto alle notifiche push. */
export function useNotificheAttive() {
  return useQuery({
    queryKey: NOTIFICHE_ATTIVE_KEY,
    queryFn: fetchNotificheAttive,
    staleTime: 5 * 60_000,
  });
}

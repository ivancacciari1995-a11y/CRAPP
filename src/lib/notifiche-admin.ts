import { useMutation, useQuery } from "@tanstack/react-query";
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

/** Invia un messaggio push libero a un giocatore, o a tutti se `giocatoreId` è omesso. */
export function useInviaNotifica() {
  return useMutation({
    mutationFn: async ({ messaggio, giocatoreId }: { messaggio: string; giocatoreId?: string }) => {
      const res = await fetch("/api/public/notifica-personalizzata", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await intestazioniAutenticate()) },
        body: JSON.stringify({ messaggio, giocatoreId }),
      });
      if (!res.ok) throw new Error("Impossibile inviare la notifica");
      return (await res.json()) as { inviate: number; destinatari: number };
    },
  });
}

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEventi, type Evento } from "./eventi";

/** Minuti dopo i quali una sessione scout inattiva viene considerata libera. */
export const SCADENZA_MINUTI = 5;

export function dataOggi(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** La partita in programma oggi, se c'è. */
export function partitaDiOggi(eventi: Evento[], oggi = dataOggi()): Evento | null {
  return eventi.find((e) => e.tipo === "partita" && e.data === oggi) ?? null;
}

export type SessioneScout = {
  evento_id: string;
  giocatore_id: string;
  giocatore_nome: string;
  aggiornato_il: string;
};

export function sessioneScaduta(s: SessioneScout | null): boolean {
  if (!s) return true;
  return Date.now() - new Date(s.aggiornato_il).getTime() > SCADENZA_MINUTI * 60_000;
}

const storageKey = (eventoId: string) => `crap-scout-session-${eventoId}`;

function readSession(eventoId: string): SessioneScout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(eventoId));
    if (!raw) return null;
    return JSON.parse(raw) as SessioneScout;
  } catch {
    return null;
  }
}

function writeSession(eventoId: string, sessione: SessioneScout | null) {
  if (typeof window === "undefined") return;
  if (sessione) {
    window.localStorage.setItem(storageKey(eventoId), JSON.stringify(sessione));
  } else {
    window.localStorage.removeItem(storageKey(eventoId));
  }
  try {
    const bc = new BroadcastChannel(`crap-scout-${eventoId}`);
    bc.postMessage(sessione);
    bc.close();
  } catch {
    // fallback: storage event is already fired by localStorage
  }
}

export const SESSIONE_KEY = (eventoId: string) => ["scout-sessione", eventoId] as const;

export function useSessioneScout(eventoId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SESSIONE_KEY(eventoId ?? "-"),
    enabled: !!eventoId,
    // Sincronizzazione via BroadcastChannel/storage: nessun polling.
    staleTime: Infinity,
    queryFn: async (): Promise<SessioneScout | null> => {
      if (!eventoId || typeof window === "undefined") return null;
      return readSession(eventoId);
    },
  });

  useEffect(() => {
    if (!eventoId) return;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`crap-scout-${eventoId}`);
      bc.onmessage = (e) => {
        queryClient.setQueryData(SESSIONE_KEY(eventoId), e.data as SessioneScout | null);
      };
    } catch {
      const onStorage = (e: StorageEvent) => {
        if (e.key === storageKey(eventoId)) {
          queryClient.setQueryData(SESSIONE_KEY(eventoId), e.newValue ? (JSON.parse(e.newValue) as SessioneScout) : null);
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
    return () => {
      if (bc) {
        bc.onmessage = null;
        bc.close();
      }
    };
  }, [eventoId, queryClient]);

  return query;
}

/** Prende il controllo dello scout se libero o scaduto. Ritorna true se ottenuto. */
export function useApriSessioneScout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventoId: string; giocatoreId: string; nome: string }) => {
      if (typeof window === "undefined") return false;
      const current = readSession(input.eventoId);
      if (current && !sessioneScaduta(current) && current.giocatore_id !== input.giocatoreId) {
        return false;
      }
      writeSession(input.eventoId, {
        evento_id: input.eventoId,
        giocatore_id: input.giocatoreId,
        giocatore_nome: input.nome,
        aggiornato_il: new Date().toISOString(),
      });
      return true;
    },
    onSuccess: (_ok, input) => {
      queryClient.invalidateQueries({ queryKey: SESSIONE_KEY(input.eventoId) });
    },
  });
}

export function useChiudiSessioneScout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventoId: string; giocatoreId: string }) => {
      if (typeof window === "undefined") return;
      const current = readSession(input.eventoId);
      if (current && current.giocatore_id === input.giocatoreId) {
        writeSession(input.eventoId, null);
      }
    },
    onSuccess: (_d, input) => {
      queryClient.invalidateQueries({ queryKey: SESSIONE_KEY(input.eventoId) });
    },
  });
}

/** Mantiene viva la sessione mentre lo scout è aperto. */
export function useHeartbeatScout(eventoId: string | null, giocatoreId: string | null, attivo: boolean) {
  useEffect(() => {
    if (!attivo || !eventoId || !giocatoreId || typeof window === "undefined") return;
    const id = window.setInterval(() => {
      const current = readSession(eventoId);
      if (current && current.giocatore_id === giocatoreId) {
        current.aggiornato_il = new Date().toISOString();
        writeSession(eventoId, current);
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, [attivo, eventoId, giocatoreId]);
}

/** Versione SSR-safe: null finché il client non è montato. */
export function usePartitaDiOggi(): { pronto: boolean; partita: Evento | null } {
  const { eventi, isPending } = useEventi();
  const [montato, setMontato] = useState(false);
  useEffect(() => {
    setMontato(true);
  }, []);
  if (!montato || isPending) return { pronto: false, partita: null };
  return { pronto: true, partita: partitaDiOggi(eventi) };
}

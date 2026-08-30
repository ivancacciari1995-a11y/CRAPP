import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Autenticazione reale con Google (DD-011). Il login non ha ancora sostituito la
 * selezione del giocatore: finché `VITE_AUTH_OBBLIGATORIA` non è `true`, `/benvenuto`
 * offre entrambe le strade, così la produzione continua a funzionare mentre la squadra
 * collega gli account.
 */
export function authObbligatoria(): boolean {
  return import.meta.env["VITE_AUTH_OBBLIGATORIA"] === "true";
}

export function useSessione() {
  const [sessione, setSessione] = useState<Session | null>(null);
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    let attivo = true;
    // Il client Supabase esplode alla costruzione se mancano le variabili d'ambiente:
    // qui va assorbito, altrimenti la schermata di accesso non si disegna proprio e
    // resta irraggiungibile anche la selezione del giocatore.
    try {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!attivo) return;
          setSessione(data.session);
          setPronta(true);
        })
        .catch(() => attivo && setPronta(true));
      const { data } = supabase.auth.onAuthStateChange((_evento, nuova) => setSessione(nuova));
      return () => {
        attivo = false;
        data.subscription.unsubscribe();
      };
    } catch (errore) {
      console.error("[auth] Supabase non disponibile", errore);
      setPronta(true);
      return () => {
        attivo = false;
      };
    }
  }, []);

  return { sessione, pronta, utenteId: sessione?.user.id ?? null };
}

export async function accediConGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function esci(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

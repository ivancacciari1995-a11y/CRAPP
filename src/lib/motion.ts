/**
 * Quel che resta del motion "fatto a mano": il rilevamento del movimento
 * ridotto (che qui tiene conto anche dei device deboli, cosa che
 * `useReducedMotion` di motion non fa) e i coriandoli.
 *
 * Le animazioni di valore — conteggi, barre, comparse — sono passate a molle
 * interrompibili: vedi `lib/molla.ts` e `components/motion/`.
 */
import { useEffect, useState } from "react";

/** True se l'utente ha chiesto meno movimento o il device è poco performante. */
export function useMotoRidotto() {
  const [ridotto, setRidotto] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const memoria = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const debole = typeof memoria === "number" && memoria > 0 && memoria < 2;
    const applica = () => setRidotto(mq.matches || debole);
    applica();
    mq.addEventListener("change", applica);
    return () => mq.removeEventListener("change", applica);
  }, []);

  return ridotto;
}

/** Coriandoli leggeri, caricati solo al momento del bisogno. */
export async function coriandoli(ridotto = false) {
  if (ridotto || typeof window === "undefined") return;
  const { default: confetti } = await import("canvas-confetti");
  confetti({
    particleCount: 70,
    spread: 65,
    startVelocity: 32,
    ticks: 120,
    scalar: 0.9,
    origin: { y: 0.7 },
    disableForReducedMotion: true,
  });
}

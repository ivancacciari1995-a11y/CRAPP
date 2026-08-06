/**
 * Sistema di micro-animazioni: solo API standard del browser (nessuna
 * dipendenza da Lovable). Funziona in qualsiasi progetto React + Vite.
 */
import { useEffect, useRef, useState } from "react";

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

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Anima un numero da 0 (o dal valore precedente) fino a `valore`.
 * Usa requestAnimationFrame: mai bloccante, zero chiamate di rete.
 */
export function useConteggio(valore: number, durata = 700) {
  const ridotto = useMotoRidotto();
  const [corrente, setCorrente] = useState(valore);
  const daRef = useRef(0);

  useEffect(() => {
    if (ridotto) {
      setCorrente(valore);
      daRef.current = valore;
      return;
    }
    const da = daRef.current;
    if (da === valore) return;
    const inizio = performance.now();
    let raf = 0;
    const step = (ora: number) => {
      const t = Math.min(1, (ora - inizio) / durata);
      setCorrente(Math.round(da + (valore - da) * easeOut(t)));
      if (t < 1) raf = requestAnimationFrame(step);
      else daRef.current = valore;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [valore, durata, ridotto]);

  return corrente;
}

/**
 * Restituisce la larghezza da applicare a una barra: parte da 0 al mount e
 * raggiunge il target al frame successivo, lasciando animare la transizione CSS.
 */
export function useRiempimento(percentuale: number) {
  const ridotto = useMotoRidotto();
  const [larghezza, setLarghezza] = useState(0);

  useEffect(() => {
    if (ridotto) {
      setLarghezza(percentuale);
      return;
    }
    const raf = requestAnimationFrame(() => setLarghezza(percentuale));
    return () => cancelAnimationFrame(raf);
  }, [percentuale, ridotto]);

  return larghezza;
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
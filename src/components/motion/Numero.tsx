import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { molla } from "@/lib/molla";

/**
 * Contatore animato per statistiche e percentuali.
 *
 * Usa una molla invece di un'interpolazione a durata fissa: se il valore
 * cambia mentre il conteggio è in corso, il numero cambia rotta dal punto in
 * cui si trova invece di ripartire da capo.
 */
export function Numero({ valore, suffisso = "" }: { valore: number; suffisso?: string }) {
  const ridotto = useReducedMotion();
  const grezzo = useMotionValue(0);
  const morbido = useSpring(grezzo, molla.ui);
  const testo = useTransform(morbido, (n) => `${Math.round(n)}${suffisso}`);

  useEffect(() => {
    if (ridotto) {
      grezzo.jump(valore);
      morbido.jump(valore);
      return;
    }
    grezzo.set(valore);
  }, [valore, ridotto, grezzo, morbido]);

  return (
    <motion.span className="tabular-nums" aria-label={`${valore}${suffisso}`}>
      {testo}
    </motion.span>
  );
}

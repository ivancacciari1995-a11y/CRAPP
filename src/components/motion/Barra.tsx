import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { molla } from "@/lib/molla";

/**
 * Barra di avanzamento a molla.
 *
 * Anima `scaleX` e non `width`: la larghezza rifà il layout a ogni frame,
 * la trasformazione la gestisce il compositore. La molla riparte dal valore
 * a schermo, quindi se il dato cambia a metà riempimento non c'è scatto.
 */
export function Barra({
  percentuale,
  className,
  trackClassName,
  altezza = "h-2",
}: {
  percentuale: number;
  className?: string;
  trackClassName?: string;
  altezza?: string;
}) {
  const ridotto = useReducedMotion();
  const valore = Math.max(0, Math.min(100, Math.round(percentuale)));

  return (
    <div
      className={cn("overflow-hidden rounded-full bg-secondary", altezza, trackClassName)}
      role="progressbar"
      aria-valuenow={valore}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={cn("h-full w-full origin-left rounded-full bg-accent-grad", className)}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: valore / 100 }}
        transition={ridotto ? { duration: 0.2 } : molla.ui}
      />
    </div>
  );
}

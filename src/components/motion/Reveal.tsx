import type { ReactNode } from "react";
import { motion, useReducedMotion, type MotionStyle } from "motion/react";
import { cn } from "@/lib/utils";
import { molla } from "@/lib/molla";

/**
 * Comparsa graduale quando l'elemento entra davvero nel viewport.
 *
 * Prima partiva al mount: gli elementi sotto la piega consumavano
 * l'animazione a vuoto e l'utente li trovava già fermi. Ora la molla è
 * interrompibile e riparte dal valore corrente, quindi uno scroll a metà
 * animazione non produce salti.
 *
 * `indice` sfalsa elementi vicini, con un tetto basso: oltre ~200 ms
 * l'ultimo elemento di una lista sembra in ritardo rispetto al tocco.
 */
export function Reveal({
  children,
  indice = 0,
  className,
  style,
  as: Tag = "div",
}: {
  children: ReactNode;
  indice?: number;
  className?: string;
  style?: MotionStyle;
  as?: "div" | "section" | "li" | "article";
}) {
  const ridotto = useReducedMotion();
  const Componente = motion[Tag];
  const ritardo = Math.min(indice, 5) * 0.04;

  return (
    <Componente
      className={cn(className)}
      {...(style ? { style } : {})}
      initial={ridotto ? { opacity: 0 } : { opacity: 0, y: 10 }}
      whileInView={ridotto ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -10% 0px" }}
      transition={ridotto ? { duration: 0.2, delay: ritardo } : { ...molla.ui, delay: ritardo }}
    >
      {children}
    </Componente>
  );
}

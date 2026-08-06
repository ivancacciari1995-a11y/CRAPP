import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Comparsa graduale con leggero slide dal basso (~300 ms).
 * `indice` sfalsa l'animazione tra elementi vicini.
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
  style?: CSSProperties;
  as?: "div" | "section" | "li" | "article";
}) {
  return (
    <Tag
      className={cn("anim-reveal", className)}
      style={{ animationDelay: `${Math.min(indice, 8) * 60}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}
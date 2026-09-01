import { cn } from "@/lib/utils";
import { useRiempimento } from "@/lib/motion";

/** Barra di avanzamento che si riempie in ~700 ms all'apertura. */
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
  const larghezza = useRiempimento(Math.max(0, Math.min(100, Math.round(percentuale))));
  return (
    <div className={cn("overflow-hidden rounded-full bg-secondary", altezza, trackClassName)}>
      <div
        className={cn("anim-barra h-full rounded-full bg-accent-grad", className)}
        style={{ width: `${larghezza}%` }}
      />
    </div>
  );
}

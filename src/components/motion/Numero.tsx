import { useConteggio } from "@/lib/motion";

/** Contatore animato per statistiche e percentuali. */
export function Numero({
  valore,
  durata = 700,
  suffisso = "",
}: {
  valore: number;
  durata?: number;
  suffisso?: string;
}) {
  const n = useConteggio(valore, durata);
  return (
    <span className="tabular-nums">
      {n}
      {suffisso}
    </span>
  );
}

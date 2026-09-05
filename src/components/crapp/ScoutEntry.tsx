import { Link } from "@tanstack/react-router";
import { ChevronRight, Lock, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { sessioneScaduta, usePartitaDiOggi, useSessioneScout } from "@/lib/scout-live";
import { useGiocatoreCorrente } from "@/lib/user-store";

/**
 * Accesso allo scout live: attivo solo il giorno della partita e se nessun altro lo sta usando.
 * Con `eventoId` si accende solo se quella partita è proprio quella di oggi.
 */
export function ScoutEntry({
  variante = "grande",
  eventoId,
}: {
  variante?: "grande" | "compatto";
  eventoId?: string;
}) {
  const { pronto, partita: diOggi } = usePartitaDiOggi();
  const partita = eventoId && diOggi?.id !== eventoId ? null : diOggi;
  const io = useGiocatoreCorrente();
  const { data: sessione } = useSessioneScout(partita?.id ?? null);

  const attiva = sessione && !sessioneScaduta(sessione) ? sessione : null;
  const occupato = !!attiva && attiva.giocatore_id !== io?.id;
  const disponibile = pronto && !!partita && !occupato;

  const titolo = !partita ? "Scout live non attivo" : occupato ? "Scout occupato" : "Scout live";
  const sottotitolo = !partita
    ? "Si attiva il giorno della partita"
    : occupato
      ? `In uso da ${attiva!.giocatore_nome}`
      : "Segna punti, ace e muri in tempo reale";

  const contenuto = (
    <>
      {occupato ? <Lock className="h-5 w-5 shrink-0" /> : <Radio className="h-5 w-5 shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg uppercase leading-none">{titolo}</span>
        <span className="block text-xs opacity-80">{sottotitolo}</span>
      </span>
      {disponibile ? <ChevronRight className="h-5 w-5 shrink-0" /> : null}
    </>
  );

  const classi = cn(
    "flex items-center gap-3 rounded-3xl p-4 shadow-card",
    variante === "compatto" && "gap-2 rounded-2xl p-3",
    disponibile
      ? "bg-accent-grad text-accent-foreground shadow-pop"
      : "bg-card text-muted-foreground",
  );

  if (!disponibile) {
    return (
      <div className={classi} aria-disabled>
        {contenuto}
      </div>
    );
  }

  return (
    <Link to="/scout" className={classi}>
      {contenuto}
    </Link>
  );
}

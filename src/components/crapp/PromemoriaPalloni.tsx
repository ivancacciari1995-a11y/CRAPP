import { AlertCircle } from "lucide-react";
import { formatData } from "@/lib/crapp-data";
import {
  eventiPalloni,
  eventoPrecedente,
  eventoSuccessivo,
  oggiISO,
} from "@/lib/palloni-core";
import { useTurniPalloni } from "@/lib/palloni";
import { useEventi } from "@/lib/eventi";
import { useGiocatoreCorrente } from "@/lib/user-store";

/** Avvisi per chi è di turno: prendere i palloni oggi, o riportarli oggi. */
export function PromemoriaPalloni() {
  const io = useGiocatoreCorrente();
  const { turni } = useTurniPalloni();
  const { eventi } = useEventi();
  if (!io) return null;

  const lista = eventiPalloni(eventi);

  const oggi = oggiISO();
  const messaggi: string[] = [];

  for (const evento of lista) {
    if (evento.data !== oggi) continue;

    if (turni[evento.id] === io.id) {
      const dopo = eventoSuccessivo(eventi, evento.id);
      messaggi.push(
        `Oggi tocca a te prendere i palloni a fine ${evento.tipo === "partita" ? "partita" : "allenamento"}` +
          (dopo ? ` e riportarli il ${formatData(dopo.data)}.` : "."),
      );
    }

    const prima = eventoPrecedente(eventi, evento.id);
    if (prima && turni[prima.id] === io.id) {
      messaggi.push("Ricordati di portare i palloni con te oggi: li hai presi tu la volta scorsa.");
    }
  }

  if (messaggi.length === 0) {
    const prossimo = lista.find((e) => e.data >= oggi && turni[e.id] === io.id);
    if (!prossimo) return null;
    messaggi.push(
      `Sei incaricato dei palloni per ${prossimo.titolo} (${formatData(prossimo.data)}).`,
    );
  }

  return (
    <div className="mx-5 mt-4 rounded-3xl bg-accent-grad p-4 text-accent-foreground shadow-pop">
      <p className="flex items-center gap-2 font-display text-lg uppercase leading-none">
        <AlertCircle className="h-5 w-5" /> Turno palloni
      </p>
      {messaggi.map((m) => (
        <p key={m} className="mt-2 text-xs leading-snug opacity-90">
          {m}
        </p>
      ))}
    </div>
  );
}
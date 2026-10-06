import { Volleyball } from "lucide-react";
import { Avviso } from "@/components/crapp/Avviso";
import { formatData } from "@/lib/crapp-data";
import { eventiPalloni, eventoPrecedente, eventoSuccessivo, oggiISO } from "@/lib/palloni-core";
import { useTurniPalloni } from "@/lib/palloni";
import { useEventi } from "@/lib/eventi";
import { useGiocatoreInCampo } from "@/lib/user-store";

/** Avvisi per chi è di turno: prendere i palloni oggi, o riportarli oggi. */
export function PromemoriaPalloni() {
  // Solo `.id` serve qui, niente statistiche; `null` per l'allenatore, che non gioca (DD-034). Montato in Home.
  const io = useGiocatoreInCampo();
  const { turni } = useTurniPalloni();
  const { eventi } = useEventi();
  if (!io) return null;

  const lista = eventiPalloni(eventi);

  const oggi = oggiISO();
  const messaggi: string[] = [];
  // «Oggi» solo se c'è davvero qualcosa da fare oggi; altrimenti è un semplice promemoria.
  let oggiTocca = true;

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
    oggiTocca = false;
    const prossimo = lista.find((e) => e.data >= oggi && turni[e.id] === io.id);
    if (!prossimo) return null;
    messaggi.push(
      `Sei incaricato dei palloni per ${prossimo.titolo} (${formatData(prossimo.data)}).`,
    );
  }

  return (
    <Avviso
      tono="azione"
      icona={Volleyball}
      titolo="Turno palloni"
      etichetta={oggiTocca ? "Oggi" : "In arrivo"}
      testi={messaggi}
      riquadri
    />
  );
}

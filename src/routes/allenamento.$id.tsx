import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Clock, Users, Dumbbell, CalendarDays } from "lucide-react";
import { PageHeader, Section } from "@/components/crapp/ui-bits";
import { formatData, giocatori } from "@/lib/crapp-data";
import { convocatiEvento, useEvento } from "@/lib/eventi";
import { TurnoPalloni } from "@/components/crapp/TurnoPalloni";
import { RosaPresenze } from "@/components/crapp/RosaPresenze";
import { usePresenzeEvento } from "@/lib/presenze";

export const Route = createFileRoute("/allenamento/$id")({
  head: () => {
    const titolo = "Dettaglio allenamento";
    return {
      meta: [
        { title: `${titolo} — CrAPP` },
        { name: "description", content: "Dettaglio allenamento, orario, luogo e presenze del CRAP Volley." },
        { property: "og:title", content: `${titolo} — CrAPP` },
        { property: "og:description", content: "Dettaglio allenamento, orario, luogo e presenze del CRAP Volley." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: AllenamentoDetail,
});

function AllenamentoDetail() {
  const { id } = Route.useParams();
  const { evento } = useEvento(id);
  const { risposte } = usePresenzeEvento(id);
  const presentiVeri = giocatori.filter(
    (g) => risposte[g.id] === "presente" || risposte[g.id] === "ritardo",
  ).length;

  if (!evento) {
    return (
      <div className="px-5 pt-8">
        <Link
          to="/calendario"
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Torna al calendario
        </Link>
        <p className="mt-8 text-center text-sm text-muted-foreground">Allenamento non trovato</p>
      </div>
    );
  }

  return (
    <>
      <div className="px-5 pt-4">
        <Link
          to="/calendario"
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Calendario
        </Link>
      </div>

      <PageHeader titolo="Allenamento" sottotitolo={formatData(evento.data)} />

      <Section titolo={evento.titolo}>
        <div className="rounded-3xl bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Dumbbell className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Allenamento di squadra
              </p>
              <p className="truncate text-lg font-bold leading-tight">{evento.titolo}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4" /> {evento.ora}
            </span>
            <span className="ml-4 inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {evento.luogo}
            </span>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
            <Users className="h-4 w-4" />
            Conferme: {presentiVeri}/{convocatiEvento(evento).length}
          </div>

          <TurnoPalloni eventoId={evento.id} />
        </div>
      </Section>

      <Section titolo="Rosa e presenze">
        <RosaPresenze eventoId={evento.id} />
      </Section>
    </>
  );
}

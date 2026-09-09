import { createFileRoute } from "@tanstack/react-router";
import { Trophy, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, Section } from "@/components/crapp/ui-bits";
import { formatData } from "@/lib/crapp-data";
import { useCsi } from "@/lib/csi";
import { DettaglioCsiEsteso, LogoSquadra, MetaPartitaCsi } from "@/components/crapp/DettaglioCsi";

export const Route = createFileRoute("/partita-csi/$id")({
  head: () => {
    const titolo = "Dettaglio partita";
    return {
      meta: [
        { title: `${titolo} — CrAPP` },
        {
          name: "description",
          content: "Dettaglio partita ufficiale CSI del CRAP Volley.",
        },
        { property: "og:title", content: `${titolo} — CrAPP` },
        { property: "og:description", content: "Dettaglio partita ufficiale CSI del CRAP Volley." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: PartitaCsiDetail,
});

/**
 * Dettaglio "solo CSI" per le gare senza un evento CrAPP collegato (l'app non crea ancora
 * eventi automaticamente dal calendario CSI): niente convocazioni/presenze/MVP/scout, solo
 * i dati ufficiali del portale. Per le gare già collegate a un evento vedi `/partita/$id`,
 * che mostra le stesse informazioni CSI in più.
 */
function PartitaCsiDetail() {
  const { id } = Route.useParams();
  const { data: csi } = useCsi();
  const partita = csi?.partite.find((p) => p.id === id);

  if (!partita) {
    return (
      <div className="px-5 pt-8">
        <p className="mt-8 text-center text-sm text-muted-foreground">Partita non trovata</p>
      </div>
    );
  }

  const giocata = partita.setNostri !== null && partita.setLoro !== null;
  const vinta = giocata && (partita.setNostri as number) > (partita.setLoro as number);

  return (
    <>
      <PageHeader titolo="Partita" sottotitolo={formatData(partita.data)} />

      <Section titolo={partita.competizione || "Campionato"}>
        <div className="rounded-3xl bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
                partita.casa ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent",
              )}
            >
              {partita.casa ? <Swords className="h-6 w-6" /> : <Trophy className="h-6 w-6" />}
            </div>
            <LogoSquadra
              src={partita.logoAvversario}
              alt={partita.avversario}
              className="h-10 w-10"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {partita.casa ? "In casa" : "Fuori casa"}
              </p>
              <p className="truncate text-lg font-bold leading-tight">{partita.avversario}</p>
            </div>
            {giocata ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 font-display text-lg",
                  vinta
                    ? "bg-success text-success-foreground"
                    : "bg-destructive text-destructive-foreground",
                )}
              >
                {partita.setNostri} - {partita.setLoro}
              </span>
            ) : null}
          </div>

          {giocata && partita.parziali.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {partita.parziali.map(([noi, loro], i) => (
                <span
                  key={i}
                  className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold tabular-nums"
                >
                  {noi}-{loro}
                </span>
              ))}
            </div>
          ) : null}

          <MetaPartitaCsi
            girone={partita.girone}
            numeroGara={partita.numeroGara}
            arbitro={partita.arbitro}
            link={partita.link}
          />
        </div>
      </Section>

      <Section titolo="Formazioni e scontri diretti">
        <DettaglioCsiEsteso matchId={partita.id} avversario={partita.avversario} />
      </Section>
    </>
  );
}

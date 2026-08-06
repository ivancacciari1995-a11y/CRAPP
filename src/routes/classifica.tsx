import { createFileRoute, Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, Section } from "@/components/crapp/ui-bits";
import { storicoMatch } from "@/lib/crapp-data";
import { classificaConScout, useScoutMatches } from "@/lib/scout-store";
import { ScoutEntry } from "@/components/crapp/ScoutEntry";

export const Route = createFileRoute("/classifica")({
  head: () => ({
    meta: [
      { title: "Classifica campionato — CrAPP" },
      {
        name: "description",
        content: "Classifica e risultati del girone CSI seguiti in tempo reale dal CRAP Volley.",
      },
      { property: "og:title", content: "Classifica campionato — CrAPP" },
      { property: "og:description", content: "Posizioni, set e risultati aggiornati del girone." },
    ],
  }),
  component: Classifica,
});

function Classifica() {
  const scoutMatches = useScoutMatches();
  const classifica = classificaConScout(scoutMatches);
  const risultati = [
    ...scoutMatches.map((m) => ({
      id: m.id,
      avversario: m.avversario,
      casa: m.casa,
      setNostri: m.setNostri,
      setLoro: m.setLoro,
    })),
    ...storicoMatch,
  ];
  return (
    <>
      <PageHeader titolo="Campionato" sottotitolo="Girone C · CSI Milano" />

      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 text-accent" />
          Dati CSI aggiornati oggi alle 08:40 (demo)
        </div>
        <div className="mt-2">
          <ScoutEntry variante="compatto" />
        </div>
      </div>

      <Section titolo="Classifica">
        <div className="overflow-hidden rounded-3xl bg-card shadow-card">
          <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem_2.5rem_2.5rem] gap-2 border-b border-border px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground">
            <span>#</span>
            <span>Squadra</span>
            <span className="text-center">G</span>
            <span className="text-center">Set</span>
            <span className="text-center">Pt</span>
          </div>
          {classifica.map((r) => {
            const noi = r.squadra === "CRAP Volley";
            return (
              <div
                key={r.pos}
                className={cn(
                  "grid grid-cols-[2rem_minmax(0,1fr)_2rem_2.5rem_2.5rem] items-center gap-2 border-b border-border px-3 py-2.5 text-sm last:border-0",
                  noi && "bg-accent/10",
                )}
              >
                <span className={cn("font-display text-base", noi && "text-accent")}>{r.pos}</span>
                <span className={cn("truncate", noi ? "font-bold" : "font-medium")}>
                  {r.squadra}
                </span>
                <span className="text-center text-xs text-muted-foreground">{r.giocate}</span>
                <span className="text-center text-xs tabular-nums text-muted-foreground">
                  {r.setFatti}:{r.setSubiti}
                </span>
                <span className="text-center font-bold tabular-nums">{r.punti}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section titolo="Ultimi risultati del girone">
        <div className="space-y-2">
          {risultati.map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3 shadow-card"
            >
              <p className="truncate text-sm">
                {m.casa ? "CRAP Volley" : m.avversario} — {m.casa ? m.avversario : "CRAP Volley"}
              </p>
              <span className="font-display text-lg tabular-nums">
                {m.casa ? `${m.setNostri}-${m.setLoro}` : `${m.setLoro}-${m.setNostri}`}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
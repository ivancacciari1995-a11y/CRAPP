import { createFileRoute, Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, Section } from "@/components/crapp/ui-bits";
import { useScoutMatches } from "@/lib/scout-store";
import { useCsi } from "@/lib/csi";
import { isNostraSquadra, matchDaPartitaCsi, partiteGiocate } from "@/lib/csi-core";
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

function formatAggiornamento(iso: string) {
  const d = new Date(iso);
  const oggi = new Date().toDateString() === d.toDateString();
  const ora = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return oggi ? `oggi alle ${ora}` : `il ${d.toLocaleDateString("it-IT")} alle ${ora}`;
}

function Classifica() {
  const scoutMatches = useScoutMatches();
  const { data: csi } = useCsi();

  const classifica = csi?.classifica ?? [];
  const risultati = csi?.partite.length
    ? partiteGiocate(csi.partite).map(matchDaPartitaCsi)
    : scoutMatches.map((m) => ({
        id: m.id,
        data: m.data,
        avversario: m.avversario,
        casa: m.casa,
        setNostri: m.setNostri,
        setLoro: m.setLoro,
        parziali: m.parziali,
      }));

  return (
    <>
      <PageHeader
        titolo="Campionato"
        sottotitolo={csi ? `${csi.girone} · CSI Bologna` : "CSI Bologna"}
      />

      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 text-accent" />
          {csi
            ? `Dati CSI aggiornati ${formatAggiornamento(csi.aggiornato)}`
            : "Dati CSI in arrivo"}
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
          {classifica.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Classifica non ancora disponibile.
            </p>
          ) : (
            classifica.map((r) => {
              const noi = isNostraSquadra(r.squadra) || r.squadra === "CRAP Volley";
              return (
                <div
                  key={r.pos}
                  className={cn(
                    "grid grid-cols-[2rem_minmax(0,1fr)_2rem_2.5rem_2.5rem] items-center gap-2 border-b border-border px-3 py-2.5 text-sm last:border-0",
                    noi && "bg-accent/10",
                  )}
                >
                  <span className={cn("font-display text-base", noi && "text-accent")}>
                    {r.pos}
                  </span>
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
            })
          )}
        </div>
      </Section>

      <Section titolo="Ultimi risultati ufficiali">
        {risultati.length === 0 ? (
          <p className="rounded-3xl bg-card p-4 text-center text-xs text-muted-foreground shadow-card">
            Nessun risultato disponibile.
          </p>
        ) : (
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
        )}
      </Section>
    </>
  );
}

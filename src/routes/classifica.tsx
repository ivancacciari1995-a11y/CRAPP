import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatData } from "@/lib/crapp-data";
import { PageHeader, Section, SezioneTendina } from "@/components/crapp/ui-bits";
import { useScoutMatches } from "@/lib/scout-store";
import { useCsi } from "@/lib/csi";
import { isNostraSquadra, matchDaPartitaCsi, partiteGiocate } from "@/lib/csi-core";
import { ScoutEntry } from "@/components/crapp/ScoutEntry";
import { useVotiMvp, vincitoriMvp } from "@/lib/mvp-voti";
import { useEventi } from "@/lib/eventi";

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
  const votiMvp = useVotiMvp();
  const mvpPerMatch = vincitoriMvp(votiMvp.data ?? []);
  const { eventi } = useEventi();

  const classifica = csi?.classifica ?? [];
  const csiGiocate = csi ? partiteGiocate(csi.partite) : [];
  const eventoIdPerData = new Map(
    eventi.filter((e) => e.tipo === "partita").map((e) => [e.data, e.id]),
  );
  const tuttiMatch = csiGiocate.length
    ? csiGiocate.map((p) => ({
        ...matchDaPartitaCsi(p),
        mvp: mvpPerMatch[p.id] ?? "",
        scout: false,
      }))
    : scoutMatches.map((m) => ({
        id: m.id,
        data: m.data,
        avversario: m.avversario,
        casa: m.casa,
        setNostri: m.setNostri,
        setLoro: m.setLoro,
        parziali: m.parziali,
        mvp: mvpPerMatch[m.id] ?? "",
        scout: true,
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

      <SezioneTendina titolo="Storico match">
        {tuttiMatch.length === 0 ? (
          <p className="rounded-3xl bg-card p-4 text-center text-xs text-muted-foreground shadow-card">
            Nessun match disponibile.
          </p>
        ) : (
          <div className="space-y-3">
            {tuttiMatch.map((m) => {
              const vinta = m.setNostri > m.setLoro;
              const eventoId = eventoIdPerData.get(m.data);
              const contenuto = (
                <>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {m.casa ? "CRAP Volley" : m.avversario} vs{" "}
                        {m.casa ? m.avversario : "CRAP Volley"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatData(m.data)} · MVP {m.mvp || "da votare"}
                        {m.scout ? " · scoutata" : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-xl px-2.5 py-1 font-display text-lg",
                        vinta
                          ? "bg-success text-success-foreground"
                          : "bg-destructive text-destructive-foreground",
                      )}
                    >
                      {m.setNostri}-{m.setLoro}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {m.parziali.map((p, i) => (
                      <span
                        key={i}
                        className={cn(
                          "rounded-lg px-2 py-1 text-[11px] font-semibold tabular-nums",
                          p[0] > p[1] ? "bg-secondary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {p[0]}-{p[1]}
                      </span>
                    ))}
                    {eventoId && !m.mvp ? (
                      <span className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-bold uppercase text-accent">
                        Vota MVP <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>
                </>
              );
              return eventoId ? (
                <Link
                  key={m.id}
                  to="/partita/$id"
                  params={{ id: eventoId }}
                  className="premi block rounded-3xl bg-card p-4 shadow-card active:scale-[0.99]"
                >
                  {contenuto}
                </Link>
              ) : (
                <article key={m.id} className="rounded-3xl bg-card p-4 shadow-card">
                  {contenuto}
                </article>
              );
            })}
          </div>
        )}
      </SezioneTendina>
    </>
  );
}

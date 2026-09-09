import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatData, type RigaClassifica } from "@/lib/crapp-data";
import { PageHeader } from "@/components/crapp/ui-bits";
import { BarraSottosezioni } from "@/components/crapp/BarraSottosezioni";
import { useScoutMatches } from "@/lib/scout-store";
import { useCsi } from "@/lib/csi";
import { isNostraSquadra, matchDaPartitaCsi, partiteGiocate } from "@/lib/csi-core";
import { useVotiMvp, vincitoriMvp } from "@/lib/mvp-voti";
import { useEventi } from "@/lib/eventi";
import { LogoSquadra } from "@/components/crapp/DettaglioCsi";

const TAB_CLASSIFICA = ["classifica", "storico"] as const;
type TabClassifica = (typeof TAB_CLASSIFICA)[number];

function isTabClassifica(v: unknown): v is TabClassifica {
  return typeof v === "string" && (TAB_CLASSIFICA as readonly string[]).includes(v);
}

export const Route = createFileRoute("/classifica")({
  validateSearch: (search: Record<string, unknown>): { tab?: TabClassifica } => {
    const tab = isTabClassifica(search["tab"]) ? search["tab"] : undefined;
    return tab ? { tab } : {};
  },
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

function TabellaClassifica({ righe, vuoto }: { righe: RigaClassifica[]; vuoto: string }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-card shadow-card">
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem_2.5rem_2.5rem] gap-2 border-b border-border px-3 py-2 text-xs font-bold uppercase text-muted-foreground">
        <span>#</span>
        <span>Squadra</span>
        <span className="text-center">G</span>
        <span className="text-center">Set</span>
        <span className="text-center">Pt</span>
      </div>
      {righe.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">{vuoto}</p>
      ) : (
        righe.map((r) => {
          const noi = isNostraSquadra(r.squadra) || r.squadra === "CRAP Volley";
          return (
            <div
              key={r.pos}
              className={cn(
                "grid grid-cols-[2rem_minmax(0,1fr)_2rem_2.5rem_2.5rem] items-center gap-2 border-b border-border px-3 py-2.5 text-sm last:border-0",
                noi && "bg-accent/10",
              )}
            >
              <span className={cn("font-display text-base", noi && "text-accent")}>{r.pos}</span>
              <span className={cn("truncate", noi ? "font-bold" : "font-medium")}>{r.squadra}</span>
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
  );
}

function formatAggiornamento(iso: string) {
  const d = new Date(iso);
  const oggi = new Date().toDateString() === d.toDateString();
  const ora = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return oggi ? `oggi alle ${ora}` : `il ${d.toLocaleDateString("it-IT")} alle ${ora}`;
}

function Classifica() {
  const { tab } = Route.useSearch();
  const scoutMatches = useScoutMatches();
  const { data: csi } = useCsi();
  const votiMvp = useVotiMvp();
  const { eventi } = useEventi();

  const classifica = useMemo(() => csi?.classifica ?? [], [csi]);
  const classificaCoppa = useMemo(() => csi?.classificaCoppa ?? [], [csi]);

  const mvpPerMatch = useMemo(() => vincitoriMvp(votiMvp.data ?? []), [votiMvp.data]);
  const eventoIdPerData = useMemo(
    () => new Map(eventi.filter((e) => e.tipo === "partita").map((e) => [e.data, e.id])),
    [eventi],
  );
  // I voti MVP sono legati all'evento CrAPP, non al referto CSI né allo scout.
  const tuttiMatch = useMemo(() => {
    const mvpPerData = (data: string) => mvpPerMatch[eventoIdPerData.get(data) ?? ""] ?? "";
    const csiGiocate = csi ? partiteGiocate(csi.partite) : [];
    return csiGiocate.length
      ? csiGiocate.map((p) => {
          const m = matchDaPartitaCsi(p);
          return { ...m, mvp: mvpPerData(m.data), scout: false };
        })
      : scoutMatches.map((m) => ({
          id: m.id,
          data: m.data,
          avversario: m.avversario,
          logoAvversario: "",
          casa: m.casa,
          setNostri: m.setNostri,
          setLoro: m.setLoro,
          parziali: m.parziali,
          mvp: mvpPerData(m.data),
          scout: true,
        }));
  }, [csi, scoutMatches, mvpPerMatch, eventoIdPerData]);

  // Ogni tab è memoizzata: un refetch in background di uno solo dei dati (CSI,
  // scout, eventi, voti MVP) non deve ricostruire il JSX dell'altra tab.
  const contenutoClassifica = useMemo(
    () => (
      <>
        <div
          className={cn(
            "mb-3 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs",
            csi?.formatoSospetto
              ? "bg-warning/15 text-warning"
              : "bg-secondary text-muted-foreground",
          )}
        >
          {csi?.formatoSospetto ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
          )}
          {csi?.formatoSospetto
            ? "Il portale CSI potrebbe aver cambiato formato: dati da verificare."
            : csi
              ? `Dati CSI aggiornati ${formatAggiornamento(csi.aggiornato)}`
              : "Dati CSI in arrivo"}
        </div>
        {classificaCoppa.length > 0 ? (
          <>
            <h3 className="mb-2 px-1 text-sm font-bold text-foreground">Coppa</h3>
            <TabellaClassifica righe={classificaCoppa} vuoto="Classifica non disponibile." />
            <h3 className="mb-2 mt-4 px-1 text-sm font-bold text-foreground">Girone</h3>
          </>
        ) : null}
        <TabellaClassifica righe={classifica} vuoto="Classifica non ancora disponibile." />
      </>
    ),
    [csi, classifica, classificaCoppa],
  );

  const contenutoStorico = useMemo(
    () =>
      tuttiMatch.length === 0 ? (
        <p className="rounded-3xl bg-card p-4 text-center text-xs text-muted-foreground shadow-card">
          Nessuna partita disponibile.
        </p>
      ) : (
        <div className="space-y-3">
          {tuttiMatch.map((m) => {
            const vinta = m.setNostri > m.setLoro;
            const eventoId = eventoIdPerData.get(m.data);
            const contenuto = (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <LogoSquadra src={m.logoAvversario} alt={m.avversario} className="h-8 w-8" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {m.casa ? "CRAP Volley" : m.avversario} vs{" "}
                        {m.casa ? m.avversario : "CRAP Volley"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatData(m.data)} · MVP {m.mvp || "da votare"}
                        {m.scout ? " · scoutata" : ""}
                      </p>
                    </div>
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
                        "rounded-lg px-2 py-1 text-xs font-semibold tabular-nums",
                        p[0] > p[1] ? "bg-secondary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {p[0]}-{p[1]}
                    </span>
                  ))}
                  {eventoId && !m.mvp ? (
                    <span className="ml-auto inline-flex items-center gap-0.5 text-xs font-bold uppercase text-accent">
                      Vota MVP <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </div>
              </>
            );
            if (eventoId) {
              return (
                <Link
                  key={m.id}
                  to="/partita/$id"
                  params={{ id: eventoId }}
                  className="premi block rounded-3xl bg-card p-4 shadow-card active:scale-[0.99]"
                >
                  {contenuto}
                </Link>
              );
            }
            // Senza evento CrAPP collegato (nessuna creazione automatica dal calendario
            // CSI, vedi "Evoluzioni possibili"): le gare scoutate localmente non hanno un
            // corrispettivo sul portale da mostrare, quelle CSI sì.
            return m.scout ? (
              <article key={m.id} className="rounded-3xl bg-card p-4 shadow-card">
                {contenuto}
              </article>
            ) : (
              <Link
                key={m.id}
                to="/partita-csi/$id"
                params={{ id: m.id }}
                className="premi block rounded-3xl bg-card p-4 shadow-card active:scale-[0.99]"
              >
                {contenuto}
              </Link>
            );
          })}
        </div>
      ),
    [tuttiMatch, eventoIdPerData],
  );

  return (
    <>
      <PageHeader
        titolo="Campionato"
        sottotitolo={csi ? `${csi.girone} · CSI Bologna` : "CSI Bologna"}
      />

      <BarraSottosezioni
        defaultId={tab ?? "classifica"}
        variante="sottolineatura"
        riempiLarghezza
        voci={[
          { id: "classifica", label: "Classifica", contenuto: contenutoClassifica },
          { id: "storico", label: "Storico partite", contenuto: contenutoStorico },
        ]}
      />
    </>
  );
}

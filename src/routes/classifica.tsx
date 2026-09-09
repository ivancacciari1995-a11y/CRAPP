import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatData, type RigaClassifica } from "@/lib/crapp-data";
import { PageHeader, TeamLogo } from "@/components/crapp/ui-bits";
import { BarraSottosezioni } from "@/components/crapp/BarraSottosezioni";
import { useScoutMatches } from "@/lib/scout-store";
import { useCsi } from "@/lib/csi";
import { isNostraSquadra, matchDaPartitaCsi, partiteGiocate } from "@/lib/csi-core";
import { useVotiMvp, vincitoriMvp } from "@/lib/mvp-voti";
import { useEventi } from "@/lib/eventi";
import { LogoSquadra } from "@/components/crapp/DettaglioCsi";

const LOGO_NOI = "/logo-nerorosso.svg";
const NOME_NOI = "CRAP Volley";

/** Logo CRAP o avversario; cerchio con iniziali se il CSI non ha l'immagine. */
function LogoPartita({
  nostro,
  logoAvversario,
  avversario,
}: {
  nostro: boolean;
  logoAvversario: string;
  avversario: string;
}) {
  if (nostro) {
    return (
      <TeamLogo src={LOGO_NOI} className="h-8 w-8 rounded-lg shadow-none" />
    );
  }
  if (logoAvversario) {
    return <LogoSquadra src={logoAvversario} alt={avversario} className="h-8 w-8" />;
  }
  const iniziali = avversario
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-[10px] font-bold text-muted-foreground"
      aria-hidden
    >
      {iniziali || "?"}
    </span>
  );
}

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
            const cliccabile = Boolean(eventoId) || !m.scout;
            const casa = {
              nome: m.casa ? NOME_NOI : m.avversario,
              nostro: m.casa,
            };
            const trasferta = {
              nome: m.casa ? m.avversario : NOME_NOI,
              nostro: !m.casa,
            };
            // Badge e parziali in ordine casa–ospite; il colore resta sulla vittoria CRAP.
            const setCasa = m.casa ? m.setNostri : m.setLoro;
            const setOspite = m.casa ? m.setLoro : m.setNostri;
            const contenuto = (
              <>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <LogoPartita
                        nostro={casa.nostro}
                        logoAvversario={m.logoAvversario}
                        avversario={m.avversario}
                      />
                      <p className="truncate text-sm font-bold">{casa.nome}</p>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <LogoPartita
                        nostro={trasferta.nostro}
                        logoAvversario={m.logoAvversario}
                        avversario={m.avversario}
                      />
                      <p className="truncate text-sm font-bold">{trasferta.nome}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatData(m.data)} · MVP {m.mvp || "da votare"}
                      {m.scout ? " · scoutata" : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-xl px-2.5 py-1 font-display text-xl",
                      vinta
                        ? "bg-success text-success-foreground"
                        : "bg-destructive text-destructive-foreground",
                    )}
                  >
                    {setCasa}-{setOspite}
                  </span>
                  {cliccabile ? (
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {m.parziali.map((p, i) => {
                    const puntiCasa = m.casa ? p[0] : p[1];
                    const puntiOspite = m.casa ? p[1] : p[0];
                    const setVintoDaNoi = p[0] > p[1];
                    return (
                      <span
                        key={i}
                        className={cn(
                          "rounded-lg px-2 py-1 text-xs font-semibold tabular-nums",
                          setVintoDaNoi
                            ? "bg-secondary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {puntiCasa}-{puntiOspite}
                      </span>
                    );
                  })}
                  {eventoId && !m.mvp ? (
                    <span className="ml-auto inline-flex items-center gap-0.5 text-xs font-bold uppercase text-accent">
                      Vota MVP <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : null}
                </div>
              </>
            );
            const aria = `${casa.nome} vs ${trasferta.nome}: dettaglio partita`;
            if (eventoId) {
              return (
                <Link
                  key={m.id}
                  to="/partita/$id"
                  params={{ id: eventoId }}
                  aria-label={aria}
                  className="premi block rounded-3xl bg-card p-4 shadow-card ring-1 ring-transparent transition-[box-shadow,transform] active:scale-[0.99] hover:ring-accent/30"
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
                aria-label={aria}
                className="premi block rounded-3xl bg-card p-4 shadow-card ring-1 ring-transparent transition-[box-shadow,transform] active:scale-[0.99] hover:ring-accent/30"
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Clock, Users, Trophy, Swords, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, Section } from "@/components/crapp/ui-bits";
import { formatData, giocatori } from "@/lib/crapp-data";
import { convocatiEvento, useEvento } from "@/lib/eventi";
import { useCsi } from "@/lib/csi";
import { matchDaPartitaCsi, partiteGiocate } from "@/lib/csi-core";
import { Pagelle } from "@/components/crapp/Pagelle";
import { SondaggioCacche } from "@/components/crapp/SondaggioCacche";
import { useScoutMatches, totaliPerGiocatore, totaliSquadra } from "@/lib/scout-store";
import { csvScoutMatch, scaricaCsv } from "@/lib/scout-export";
import { useGiocatoreCorrente } from "@/lib/user-store";
import { useIsAdmin } from "@/lib/ruoli";
import { VotazioneMvp } from "@/components/crapp/VotazioneMvp";
import { VotoSocial } from "@/components/crapp/VotoSocial";
import { TurnoPalloni } from "@/components/crapp/TurnoPalloni";
import { RosaPresenze } from "@/components/crapp/RosaPresenze";
import { usePresenzeEvento } from "@/lib/presenze";

export const Route = createFileRoute("/partita/$id")({
  head: () => {
    const titolo = "Dettaglio partita";
    return {
      meta: [
        { title: `${titolo} — CrAPP` },
        {
          name: "description",
          content: "Dettaglio partita, formazione e risultati del CRAP Volley.",
        },
        { property: "og:title", content: `${titolo} — CrAPP` },
        {
          property: "og:description",
          content: "Dettaglio partita, formazione e risultati del CRAP Volley.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: PartitaDetail,
});

function PartitaDetail() {
  const { id } = Route.useParams();
  const { evento } = useEvento(id);
  const io = useGiocatoreCorrente();
  const admin = useIsAdmin();
  const scoutMatches = useScoutMatches();
  const { data: csi } = useCsi();
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
        <p className="mt-8 text-center text-sm text-muted-foreground">Partita non trovata</p>
      </div>
    );
  }

  const convocati = convocatiEvento(evento);
  const scout = scoutMatches.find((m) => m.id === evento.id || m.data === evento.data) ?? null;
  const csiMatch = csi
    ? partiteGiocate(csi.partite).find((p) => p.data === evento.data)
    : undefined;
  const match = scout
    ? {
        id: scout.id,
        data: scout.data,
        avversario: scout.avversario,
        casa: scout.casa,
        setNostri: scout.setNostri,
        setLoro: scout.setLoro,
        parziali: scout.parziali,
      }
    : csiMatch
      ? matchDaPartitaCsi(csiMatch)
      : undefined;
  const totaliTeam = scout ? totaliSquadra([scout]) : null;
  const avversario = evento.titolo.includes(" vs ")
    ? (evento.titolo.split(" vs ").find((p) => !p.includes("CRAP")) ?? evento.titolo)
    : evento.titolo;
  const casa = evento.casa;
  const vinta = match && match.setNostri > match.setLoro;

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

      <PageHeader
        titolo={evento.campionato ? "Partita" : "Amichevole"}
        sottotitolo={formatData(evento.data)}
      />

      <Section titolo={evento.titolo}>
        <div className="rounded-3xl bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
                casa ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent",
              )}
            >
              {casa ? <Swords className="h-6 w-6" /> : <Trophy className="h-6 w-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {casa ? "In casa" : "Fuori casa"}
                {evento.campionato ? " · Campionato" : " · Amichevole"}
              </p>
              <p className="truncate text-lg font-bold leading-tight">{avversario}</p>
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
            Conferme: {presentiVeri}/{convocati.length}
          </div>

          <TurnoPalloni eventoId={evento.id} />
        </div>
      </Section>

      {match ? (
        <Section titolo="Risultato">
          <div className="rounded-3xl bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">CRAP Volley</span>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-lg font-display font-bold",
                  vinta
                    ? "bg-success text-success-foreground"
                    : "bg-destructive text-destructive-foreground",
                )}
              >
                {match.setNostri} - {match.setLoro}
              </span>
              <span className="text-right text-sm font-bold">{avversario}</span>
            </div>
            <div className="mt-4 space-y-2">
              {match.parziali.map(([noi, loro], i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2"
                >
                  <span className="font-display text-lg">{noi}</span>
                  <span className="text-xs font-semibold text-muted-foreground">Set {i + 1}</span>
                  <span className="font-display text-lg">{loro}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">
              MVP eletto dalla squadra
            </p>
            <VotazioneMvp matchId={match.id} />
          </div>
        </Section>
      ) : null}

      {match ? (
        <Section titolo="Badge votati dai compagni">
          <VotoSocial matchId={match.id} />
        </Section>
      ) : (
        <Section titolo="In programma">
          <p className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
            La partita non è ancora stata disputata. Torna qui dopo il fischio finale per vedere il
            risultato.
          </p>
        </Section>
      )}

      <Section titolo="Sondaggio pre-partita">
        <SondaggioCacche eventoId={evento.id} />
      </Section>

      {match ? (
        <Section titolo="Pagelle di fine partita">
          <Pagelle matchId={match.id} convocati={convocati} chiuse={evento.pagelleChiuse} />
        </Section>
      ) : null}

      {scout && totaliTeam ? (
        <Section titolo="Report tecnico">
          <div className="rounded-3xl bg-card p-4 shadow-card">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { l: "Punti", v: totaliTeam.punti },
                { l: "Ace", v: totaliTeam.ace },
                { l: "Muri", v: totaliTeam.muri },
                { l: "Errori", v: totaliTeam.errori },
              ].map((t) => (
                <div key={t.l} className="rounded-2xl bg-secondary p-2.5">
                  <p className="font-display text-xl leading-none">{t.v}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase text-muted-foreground">
                    {t.l}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Dettaglio giocatori (uso interno allenatori)
            </p>
            <div className="mt-2 space-y-1">
              {[...totaliPerGiocatore(scout.azioni).entries()].map(([gid, t]) => {
                const g = giocatori.find((x) => x.id === gid);
                if (!g) return null;
                return (
                  <div
                    key={gid}
                    className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      #{g.numero} {g.nome}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {t.punti}P · {t.ace}A · {t.muri}M · {t.errori}E
                    </span>
                  </div>
                );
              })}
            </div>
            {admin ? (
              <button
                type="button"
                onClick={() =>
                  scaricaCsv(`scout-${scout.data}-${scout.avversario}.csv`, csvScoutMatch(scout))
                }
                className="premi mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-grad py-3 text-sm font-bold uppercase text-accent-foreground shadow-pop"
              >
                <Download className="h-4 w-4" /> Esporta CSV
              </button>
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section titolo="Rosa e presenze">
        <RosaPresenze eventoId={evento.id} />
      </Section>
    </>
  );
}

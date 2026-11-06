import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Clock, Users, Trophy, Swords, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, PageHeader, Section } from "@/components/crapp/ui-bits";
import { formatData } from "@/lib/crapp-data";
import { convocatiEvento, useEvento } from "@/lib/eventi";
import { useRosa } from "@/lib/rosa";
import { useCsi } from "@/lib/csi";
import { matchDaPartitaCsi, partiteGiocate } from "@/lib/csi-core";
import { DettaglioCsiEsteso, LogoSquadra, MetaPartitaCsi } from "@/components/crapp/DettaglioCsi";
import { Pagelle } from "@/components/crapp/Pagelle";
import { SondaggioCacche } from "@/components/crapp/SondaggioCacche";
import { ScoutEntry } from "@/components/crapp/ScoutEntry";
import { haPunteggio, useScoutMatches } from "@/lib/scout-store";
import { ScoutReport } from "@/components/crapp/ScoutReport";
import { useIsAdmin } from "@/lib/ruoli";
import { useSonoAllenatore } from "@/lib/user-store";
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
  const admin = useIsAdmin();
  const sonoAllenatore = useSonoAllenatore();
  const scoutMatches = useScoutMatches();
  const { data: csi } = useCsi();
  const { risposte } = usePresenzeEvento(id);
  const rosa = useRosa();
  const presentiVeri = rosa.filter(
    (g) => risposte[g.id] === "presente" || risposte[g.id] === "ritardo",
  ).length;

  if (!evento) {
    return (
      <div className="px-5 pt-8">
        <p className="mt-8 text-center text-[15px] text-muted-foreground">Partita non trovata</p>
      </div>
    );
  }

  const convocati = convocatiEvento(evento, rosa);
  const scout = scoutMatches.find((m) => m.id === evento.id || m.data === evento.data) ?? null;
  const csiMatch = csi
    ? partiteGiocate(csi.partite).find((p) => p.data === evento.data)
    : undefined;
  const match =
    scout && haPunteggio(scout)
      ? {
          id: scout.id,
          data: scout.data,
          avversario: scout.avversario,
          logoAvversario: "",
          casa: scout.casa,
          setNostri: scout.setNostri,
          setLoro: scout.setLoro,
          parziali: scout.parziali,
          campo: "",
          girone: "",
          numeroGara: "",
          arbitro: "",
          link: "",
        }
      : csiMatch
        ? matchDaPartitaCsi(csiMatch)
        : undefined;
  const avversario = evento.titolo.includes(" vs ")
    ? (evento.titolo.split(" vs ").find((p) => !p.includes("CRAP")) ?? evento.titolo)
    : evento.titolo;
  const casa = evento.casa;
  const vinta = match && match.setNostri > match.setLoro;

  return (
    <>
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
            {match?.logoAvversario ? (
              <LogoSquadra src={match.logoAvversario} alt={avversario} className="h-10 w-10" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
                {casa ? "In casa" : "Fuori casa"}
                {evento.campionato ? " · Campionato" : " · Amichevole"}
              </p>
              <p className="truncate text-lg font-bold leading-tight">{avversario}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-[15px] text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4" /> {evento.ora}
            </span>
            <span className="ml-4 inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {evento.luogo}
            </span>
            {evento.linkMaps ? (
              <a
                href={evento.linkMaps}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-4 inline-flex items-center gap-2 font-semibold text-accent underline"
              >
                <MapPin className="h-4 w-4" /> Apri su Maps
              </a>
            ) : null}
          </div>

          {evento.note ? (
            <p className="mt-3 whitespace-pre-line rounded-2xl bg-secondary px-3 py-2 text-[15px]">
              {evento.note}
            </p>
          ) : null}

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-[13px] font-semibold">
            <Users className="h-4 w-4" />
            Conferme: {presentiVeri}/{convocati.length}
          </div>

          {csiMatch ? (
            <MetaPartitaCsi
              girone={csiMatch.girone}
              numeroGara={csiMatch.numeroGara}
              arbitro={csiMatch.arbitro}
              link={csiMatch.link}
            />
          ) : null}

          <TurnoPalloni eventoId={evento.id} />
        </div>
      </Section>

      {match ? (
        <Section titolo="Risultato">
          <div className="rounded-3xl bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold">CRAP Volley</span>
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
              <span className="text-right text-[15px] font-bold">{avversario}</span>
            </div>
            <div className="mt-4 space-y-2">
              {match.parziali.map(([noi, loro], i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2"
                >
                  <span className="font-display text-lg">{noi}</span>
                  <span className="text-[13px] font-semibold text-muted-foreground">
                    Set {i + 1}
                  </span>
                  <span className="font-display text-lg">{loro}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {csiMatch ? (
        <Section titolo="Formazioni e scontri diretti">
          <DettaglioCsiEsteso matchId={csiMatch.id} avversario={avversario} />
        </Section>
      ) : null}

      <Section titolo="MVP eletto dalla squadra">
        <div className="rounded-3xl bg-card p-5 shadow-card">
          <VotazioneMvp evento={evento} />
        </div>
      </Section>

      {match ? (
        // Badge e cacche non si mostrano all'allenatore (DD-034).
        sonoAllenatore ? null : (
          <Section titolo="Badge votati dai compagni">
            <VotoSocial matchId={match.id} />
          </Section>
        )
      ) : (
        <Section titolo="In programma">
          <p className="rounded-3xl bg-card p-5 text-center text-[15px] text-muted-foreground shadow-card">
            La partita non è ancora stata disputata. Torna qui dopo il fischio finale per vedere il
            risultato.
          </p>
        </Section>
      )}

      <Section titolo="Scout live">
        <ScoutEntry eventoId={evento.id} />
      </Section>

      {sonoAllenatore ? null : (
        <Section titolo="Sondaggio pre-partita">
          <SondaggioCacche eventoId={evento.id} dataEvento={evento.data} oraEvento={evento.ora} />
        </Section>
      )}

      {match ? (
        <Section titolo="Pagelle di fine partita">
          <Pagelle matchId={match.id} convocati={convocati} chiuse={evento.pagelleChiuse} />
        </Section>
      ) : null}

      {scout ? (
        <Section titolo="Scout">
          <ScoutReport scout={scout} rosa={rosa} admin={admin} />
        </Section>
      ) : null}

      <Section titolo="Rosa e presenze">
        <RosaPresenze
          eventoId={evento.id}
          data={evento.data}
          tipo={evento.tipo}
          convocati={evento.convocati}
        />
      </Section>
    </>
  );
}

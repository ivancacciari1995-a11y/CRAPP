import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, ChevronRight } from "lucide-react";
import { EventoCard, linkPerEvento } from "@/components/crapp/EventoCard";
import { PromemoriaPalloni } from "@/components/crapp/PromemoriaPalloni";
import { ScoutEntry } from "@/components/crapp/ScoutEntry";
import { Section, StatTile, TeamLogo } from "@/components/crapp/ui-bits";
import { CompletaProfilo } from "@/components/crapp/ProfiloAmministrativo";
import { Reveal } from "@/components/motion/Reveal";
import { Barra } from "@/components/motion/Barra";
import { Numero } from "@/components/motion/Numero";
import { classifica, storicoMatch } from "@/lib/crapp-data";
import { microcopyObiettivo, progressoObiettivo } from "@/lib/obiettivi";
import { useEventi, type Evento } from "@/lib/eventi";
import { useIo, useObiettivi } from "@/lib/rosa";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CrAPP — L'app del CRAP Volley" },
      {
        name: "description",
        content:
          "Convocazioni, presenze, statistiche e classifica del CRAP Volley in un'unica app mobile.",
      },
      { property: "og:title", content: "CrAPP — L'app del CRAP Volley" },
      {
        property: "og:description",
        content:
          "Convocazioni, presenze, statistiche e classifica del CRAP Volley in un'unica app mobile.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const giocatore = useIo();
  const { eventi } = useEventi();
  const oggi = new Date().toISOString().slice(0, 10);
  const prossimi: Evento[] = eventi.filter((e) => e.data >= oggi).slice(0, 3);
  const prossimo = prossimi[0] ?? null;
  const linkProssimo = prossimo ? linkPerEvento(prossimo) : null;
  const noi = classifica.find((r) => r.squadra === "CRAP Volley")!;
  const ultima = storicoMatch[0]!;
  const obiettivi = useObiettivi();
  const obiettivo = obiettivi.find((o) => progressoObiettivo(o) < 100) ?? obiettivi[0] ?? null;

  if (!giocatore) return null;

  return (
    <>
      <Reveal as="section" className="bg-hero px-5 pb-10 pt-7 text-primary-foreground">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/60">
              Ciao {giocatore.nome.split(" ")[0]}
            </p>
            <h1 className="font-display text-4xl uppercase leading-none">CrAPP</h1>
          </div>
          <TeamLogo className="h-12 w-12" />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-primary-foreground/10 p-3">
            <p className="font-display text-2xl leading-none">{noi.pos}º</p>
            <p className="text-[10px] uppercase text-primary-foreground/60">In classifica</p>
          </div>
          <div className="rounded-2xl bg-primary-foreground/10 p-3">
            <p className="font-display text-2xl leading-none">
              {noi.vinte}-{noi.perse}
            </p>
            <p className="text-[10px] uppercase text-primary-foreground/60">Bilancio</p>
          </div>
          <div className="rounded-2xl bg-primary-foreground/10 p-3">
            <p className="inline-flex items-center gap-1 font-display text-2xl leading-none">
              <Flame className="h-4 w-4 text-accent" />
              {giocatore.streak}
            </p>
            <p className="text-[10px] uppercase text-primary-foreground/60">Streak</p>
          </div>
        </div>
      </Reveal>

      <PromemoriaPalloni />

      <Section
        titolo="Prossimo impegno"
        indice={1}
        azione={
          <Link
            to="/calendario"
            className="inline-flex items-center text-xs font-semibold text-accent"
          >
            Calendario <ChevronRight className="h-4 w-4" />
          </Link>
        }
      >
        {prossimo ? (
          <EventoCard evento={prossimo} {...(linkProssimo ? { linkTo: linkProssimo } : {})} />
        ) : (
          <p className="rounded-3xl bg-card p-4 text-xs text-muted-foreground shadow-card">
            Nessun impegno in programma.
          </p>
        )}
        <div className="mt-3">
          <ScoutEntry />
        </div>
      </Section>

      <CompletaProfilo giocatoreId={giocatore.id} indice={2} />

      <Section titolo="Da confermare" indice={2}>
        <div className="space-y-3">
          {prossimi.slice(1).map((e) => {
            const link = linkPerEvento(e);
            return <EventoCard key={e.id} evento={e} {...(link ? { linkTo: link } : {})} />;
          })}
        </div>
      </Section>

      <Section
        titolo="Ultima partita"
        indice={3}
        azione={
          <Link
            to="/squadra"
            className="inline-flex items-center text-xs font-semibold text-accent"
          >
            Storico <ChevronRight className="h-4 w-4" />
          </Link>
        }
      >
        <div className="premi rounded-3xl bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">CRAP Volley vs {ultima.avversario}</p>
              <p className="text-xs text-muted-foreground">
                {ultima.casa ? "In casa" : "Trasferta"} · MVP {ultima.mvp}
              </p>
            </div>
            <p className="font-display text-3xl leading-none text-accent">
              {ultima.setNostri}-{ultima.setLoro}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ultima.parziali.map((p, i) => (
              <span
                key={i}
                className="rounded-lg bg-secondary px-2 py-1 text-[11px] font-semibold tabular-nums"
              >
                {p[0]}-{p[1]}
              </span>
            ))}
          </div>
        </div>
      </Section>

      <Section
        titolo="Obiettivo di squadra"
        indice={4}
        azione={
          <Link
            to="/squadra"
            className="inline-flex items-center text-xs font-semibold text-accent"
          >
            Tutti <ChevronRight className="h-3 w-3" />
          </Link>
        }
      >
        {obiettivo ? (
          <div className="premi rounded-3xl bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="text-base leading-none">{obiettivo.emoji}</span> {obiettivo.titolo}
            </div>
            <Barra percentuale={progressoObiettivo(obiettivo)} trackClassName="mt-3" />
            <p className="mt-2 text-xs text-muted-foreground">
              Siamo al <Numero valore={progressoObiettivo(obiettivo)} suffisso="%" /> —{" "}
              {obiettivo.valore}/{obiettivo.target} {obiettivo.unita}.
            </p>
            <p className="mt-1 text-xs font-semibold text-accent">
              {microcopyObiettivo(obiettivo)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{obiettivo.impatto}</p>
          </div>
        ) : null}
      </Section>

      <Section titolo="Colpo d'occhio" indice={5}>
        <div className="grid grid-cols-3 gap-2">
          <StatTile valore={giocatore.presenze} label="Presenze" hint="+2 questo mese" />
          <StatTile valore={giocatore.mediaVoto || "—"} label="Media voto" />
          <StatTile valore={giocatore.mvp} label="MVP" />
        </div>
      </Section>
    </>
  );
}

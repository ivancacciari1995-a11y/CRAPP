import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, ChevronRight } from "lucide-react";
import { EventoCard, linkPerEvento } from "@/components/crapp/EventoCard";
import { PromemoriaPalloni } from "@/components/crapp/PromemoriaPalloni";
import { Card, LinkProfilo, Section, StatTile, TeamLogo } from "@/components/crapp/ui-bits";
import { CompletaProfilo } from "@/components/crapp/ProfiloAmministrativo";
import { Reveal } from "@/components/motion/Reveal";
import { Barra } from "@/components/motion/Barra";
import { Numero } from "@/components/motion/Numero";
import { microcopyObiettivo, progressoObiettivo } from "@/lib/obiettivi";
import { useEventi, type Evento } from "@/lib/eventi";
import { useIo, useObiettivi } from "@/lib/rosa";
import { useCsi } from "@/lib/csi";
import { isNostraSquadra, matchDaPartitaCsi, partiteGiocate } from "@/lib/csi-core";
import { useScoutMatches } from "@/lib/scout-store";
import { useVotiMvp, vincitoriMvp } from "@/lib/mvp-voti";

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
  const daConfermare = prossimi.slice(1);
  const linkProssimo = prossimo ? linkPerEvento(prossimo) : null;
  const { data: csi } = useCsi();
  const noi = csi?.classifica.find((r) => isNostraSquadra(r.squadra));
  const scoutMatches = useScoutMatches();
  const votiMvp = useVotiMvp();
  const mvpPerMatch = vincitoriMvp(votiMvp.data ?? []);
  const csiGiocate = csi ? partiteGiocate(csi.partite) : [];
  const ultima = csiGiocate[0]
    ? { ...matchDaPartitaCsi(csiGiocate[0]), mvp: mvpPerMatch[csiGiocate[0].id] ?? "" }
    : scoutMatches[0]
      ? { ...scoutMatches[0], mvp: mvpPerMatch[scoutMatches[0].id] ?? "" }
      : null;
  const obiettivi = useObiettivi();
  const obiettivo = obiettivi.find((o) => progressoObiettivo(o) < 100) ?? obiettivi[0] ?? null;
  const eventoUltima = ultima
    ? (eventi.find((e) => e.tipo === "partita" && e.data === ultima.data) ?? null)
    : null;

  if (!giocatore) return null;

  return (
    <>
      <Reveal as="section" className="bg-hero px-5 pb-10 pt-7 text-primary-foreground">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <TeamLogo
              src="/logo-nerorosso.svg"
              className="h-14 w-14 rounded-full shadow-pop ring-2 ring-primary-foreground/25"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/80">
                Ciao {giocatore.nome.split(" ")[0]}
              </p>
              <h1 className="font-display-lg text-4xl uppercase leading-none">CRAP Volley</h1>
            </div>
          </div>
          <LinkProfilo />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-primary-foreground/10 p-3">
            <p className="font-display text-2xl leading-none">{noi ? `${noi.pos}º` : "—"}</p>
            <p className="text-xs uppercase text-primary-foreground/80">In classifica</p>
          </div>
          <div className="rounded-2xl bg-primary-foreground/10 p-3">
            <p className="font-display text-2xl leading-none">
              {noi ? `${noi.vinte}-${noi.perse}` : "—"}
            </p>
            <p className="text-xs uppercase text-primary-foreground/80">Bilancio vittorie</p>
          </div>
          <div className="rounded-2xl bg-primary-foreground/10 p-3">
            <p className="inline-flex items-center gap-1 font-display text-2xl leading-none">
              <Flame className="h-4 w-4 text-accent" />
              {giocatore.streak}
            </p>
            <p className="text-xs uppercase text-primary-foreground/80">Streak</p>
          </div>
        </div>
      </Reveal>

      <PromemoriaPalloni />

      <CompletaProfilo giocatoreId={giocatore.id} indice={1} />

      <Section
        titolo="Prossimo impegno"
        indice={2}
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
      </Section>

      <Section titolo="Da confermare" indice={3}>
        <div className="space-y-3">
          {daConfermare.length > 0 ? (
            daConfermare.map((e) => {
              const link = linkPerEvento(e);
              return <EventoCard key={e.id} evento={e} {...(link ? { linkTo: link } : {})} />;
            })
          ) : (
            <p className="rounded-3xl bg-card p-4 text-xs text-muted-foreground shadow-card">
              Nient'altro da confermare: sei in pari.
            </p>
          )}
        </div>
      </Section>

      <Section
        titolo="Ultima partita"
        indice={4}
        azione={
          <Link
            to="/squadra"
            className="inline-flex items-center text-xs font-semibold text-accent"
          >
            Storico <ChevronRight className="h-4 w-4" />
          </Link>
        }
      >
        {ultima ? (
          (() => {
            const corpo = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">CRAP Volley vs {ultima.avversario}</p>
                    <p className="text-xs text-muted-foreground">
                      {ultima.casa ? "In casa" : "Trasferta"}
                      {ultima.mvp ? ` · MVP ${ultima.mvp}` : " · MVP da votare"}
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
                      className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold tabular-nums"
                    >
                      {p[0]}-{p[1]}
                    </span>
                  ))}
                </div>
              </>
            );
            return eventoUltima ? (
              <Link
                to="/partita/$id"
                params={{ id: eventoUltima.id }}
                className="premi block rounded-3xl bg-card p-4 shadow-card active:scale-[0.99]"
              >
                {corpo}
              </Link>
            ) : (
              <Card>{corpo}</Card>
            );
          })()
        ) : (
          <p className="rounded-3xl bg-card p-4 text-xs text-muted-foreground shadow-card">
            Nessun risultato disponibile.
          </p>
        )}
      </Section>

      <Section
        titolo="Obiettivo di squadra"
        indice={5}
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
          <Card>
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
            <p className="mt-1 text-xs text-muted-foreground">{obiettivo.impatto}</p>
          </Card>
        ) : null}
      </Section>

      <Section titolo="Colpo d'occhio" indice={6}>
        <div className="grid grid-cols-3 gap-2">
          <StatTile valore={giocatore.presenze} label="Presenze" hint="+2 questo mese" />
          <StatTile valore={giocatore.mediaVoto || "—"} label="Media voto" />
          <StatTile valore={giocatore.mvp} label="MVP" />
        </div>
      </Section>
    </>
  );
}

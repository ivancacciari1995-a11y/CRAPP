import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Cake, ChevronDown, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, Section } from "@/components/crapp/ui-bits";
import { Avatar } from "@/components/crapp/Avatar";
import { formatData } from "@/lib/crapp-data";
import { microcopyObiettivo, progressoObiettivo } from "@/lib/obiettivi";
import { useRosa, useObiettivi } from "@/lib/rosa";
import { usePresenzeUltimoMeseTutti } from "@/lib/presenze-mese";
import { totaliSquadra } from "@/lib/scout-store";
import { useCsi } from "@/lib/csi";
import { matchDaPartitaCsi, partiteGiocate } from "@/lib/csi-core";
import { mediaSquadra, usePagelle } from "@/lib/pagelle";
import { ScoutEntry } from "@/components/crapp/ScoutEntry";
import { StatTile } from "@/components/crapp/ui-bits";
import { Reveal } from "@/components/motion/Reveal";
import { Barra } from "@/components/motion/Barra";
import { Numero } from "@/components/motion/Numero";
import { useScoutMatches } from "@/lib/scout-store";
import { useVotiMvp, vincitoriMvp } from "@/lib/mvp-voti";
import { BadgeDrawer } from "@/components/crapp/BadgeDrawer";
import {
  badgeDefs,
  badgeGiocatore,
  badgeSegretiSbloccati,
  descrizioneSoglie,
  gradiOrdine,
  gradoMeta,
  gradoRaggiunto,
  collezioneBadge,
} from "@/lib/badges";

function RuoloBadge({ ruolo }: { ruolo: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
      {ruolo}
    </span>
  );
}

export const Route = createFileRoute("/squadra")({
  head: () => ({
    meta: [
      { title: "Squadra CRAP Volley — CrAPP" },
      {
        name: "description",
        content:
          "Rosa completa del CRAP Volley: giocatori, dati anagrafici, statistiche stagionali e badge sbloccati.",
      },
      { property: "og:title", content: "Squadra CRAP Volley — CrAPP" },
      {
        property: "og:description",
        content: "Tutti i giocatori della rosa con dati, statistiche e obiettivi raggiunti.",
      },
    ],
  }),
  component: Squadra,
});

const criteri = [
  { id: "presenze", label: "Presenze" },
  { id: "mediaVoto", label: "Media voto" },
  { id: "mvp", label: "MVP" },
  { id: "palloni", label: "Palloni" },
  { id: "cacchePartita", label: "Cacche/partita" },
] as const;

type Criterio = (typeof criteri)[number]["id"];

function valore(
  g: { presenze: number; mediaVoto: number; mvp: number; palloni: number; cacchePartita: number },
  c: Criterio,
) {
  return g[c] ?? 0;
}

function Squadra() {
  const rosa = useRosa();
  const mese = usePresenzeUltimoMeseTutti();
  const scoutMatches = useScoutMatches();
  const votiMvp = useVotiMvp();
  const { voti: pagelle } = usePagelle();
  const mvpPerMatch = vincitoriMvp(votiMvp.data ?? []);
  const [aperto, setAperto] = useState<string | null>(null);
  const [criterio, setCriterio] = useState<Criterio>("presenze");
  const obiettivi = useObiettivi();
  const team = totaliSquadra(scoutMatches);
  const mediaPresenze = rosa.length
    ? Math.round(
        (rosa.reduce((s, g) => s + g.presenze / (g.totaliEventi || 1), 0) / rosa.length) * 100,
      )
    : 0;
  const ordinati = [...rosa].sort((a, b) => valore(b, criterio) - valore(a, criterio));
  const max = ordinati[0] ? valore(ordinati[0], criterio) || 1 : 1;
  const { data: csi } = useCsi();
  const csiGiocate = csi ? partiteGiocate(csi.partite) : [];
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
  const completati = obiettivi.filter((o) => progressoObiettivo(o) >= 100).length;
  const mediaObiettivi = obiettivi.length
    ? Math.round(obiettivi.reduce((s, o) => s + progressoObiettivo(o), 0) / obiettivi.length)
    : 0;

  return (
    <>
      <PageHeader titolo="Squadra" sottotitolo={`${rosa.length} giocatori · Stagione 2026/27`} />

      <Section titolo="Rosa">
        <div className="space-y-2">
          {rosa.map((g) => {
            const stati = badgeGiocatore(g);
            const sbloccati = [
              ...stati.filter((b) => b.grado !== null),
              ...badgeSegretiSbloccati(g),
            ];
            const isOpen = aperto === g.id;
            return (
              <article key={g.id} className="overflow-hidden rounded-3xl bg-card shadow-card">
                <button
                  type="button"
                  onClick={() => setAperto(isOpen ? null : g.id)}
                  className="flex w-full items-center gap-3 p-3 text-left active:scale-[0.99]"
                  aria-expanded={isOpen}
                >
                  <Avatar
                    id={g.id}
                    fallback={g.numero ? String(g.numero) : g.iniziali}
                    className="h-11 w-11 text-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold leading-tight">{g.nome}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <RuoloBadge ruolo={g.ruolo} />
                      <span className="text-[11px] text-muted-foreground">
                        {g.numero ? `#${g.numero}` : "n° da definire"}
                      </span>
                    </span>
                  </span>
                  {sbloccati.length > 0 ? (
                    <span className="flex max-w-[74px] shrink-0 flex-wrap items-center justify-end gap-0.5">
                      {sbloccati.map((b) => {
                        const Icon = b.def.icon;
                        return (
                          <span key={b.def.id} className="cursor-help" title={b.def.nome}>
                            <Icon className={cn("h-3 w-3", gradoMeta[b.grado!].text)} />
                          </span>
                        );
                      })}
                    </span>
                  ) : null}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {isOpen ? (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Cake className="h-3.5 w-3.5" /> {formatData(g.nascita)}{" "}
                        {g.nascita.slice(0, 4)}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        { l: "Presenze", v: `${g.presenze}/${g.totaliEventi}` },
                        { l: "Presenze 30gg", v: `${mese[g.id]?.percentuale ?? 0}%` },
                        { l: "Presenze di fila", v: g.streak },
                        { l: "Media voto", v: g.mediaVoto || "—" },
                        { l: "MVP", v: g.mvp },
                        { l: "Cacche/partita 💩", v: g.cacchePartita || "—" },
                      ].map((s) => (
                        <div key={s.l} className="rounded-2xl bg-secondary p-2.5 text-center">
                          <p className="font-display text-xl leading-none">{s.v}</p>
                          <p className="mt-1 text-[10px] font-semibold uppercase text-muted-foreground">
                            {s.l}
                          </p>
                        </div>
                      ))}
                    </div>

                    <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Badge sbloccati · {collezioneBadge(g).ottenuti}/{collezioneBadge(g).totali}
                    </p>
                    {sbloccati.length === 0 ? (
                      <p className="mt-2 rounded-2xl bg-secondary/50 p-3 text-xs text-muted-foreground">
                        Nessun badge sbloccato per ora.
                      </p>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {sbloccati.map((b) => {
                          const Icon = b.def.icon;
                          const meta = gradoMeta[b.grado!];
                          return (
                            <BadgeDrawer key={b.def.id} def={b.def} stato={b}>
                              <div className={cn("rounded-2xl p-2.5 ring-1", meta.bg, meta.ring)}>
                                <Icon className={cn("h-4 w-4", meta.text)} />
                                <p className="mt-1 text-xs font-bold leading-tight">{b.def.nome}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {b.valore} {b.def.unita}
                                  {b.prossimaSoglia
                                    ? ` · ${b.prossimaSoglia} per ${gradoMeta[b.prossimo!].label.toLowerCase()}`
                                    : ""}
                                </p>
                                <p
                                  className={cn(
                                    "mt-1.5 text-[10px] font-bold uppercase",
                                    meta.text,
                                  )}
                                >
                                  {meta.label}
                                </p>
                              </div>
                            </BadgeDrawer>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </Section>

      <Section titolo="Statistiche di squadra">
        <div className="grid grid-cols-3 gap-2">
          <StatTile valore={`${mediaPresenze}%`} label="Media presenze" />
          <StatTile valore={tuttiMatch.length} label="Match giocati" />
          <StatTile valore={mediaSquadra(pagelle) || "—"} label="Media pagelle" />
          <StatTile valore={team.punti} label="Punti squadra" />
          <StatTile valore={team.ace} label="Ace squadra" />
          <StatTile valore={team.muri} label="Muri squadra" />
        </div>
        <div className="mt-3">
          <ScoutEntry />
        </div>
      </Section>

      <Section titolo="Classifica giocatori">
        <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1">
          {criteri.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCriterio(c.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase transition-colors",
                criterio === c.id
                  ? "bg-accent text-accent-foreground shadow-pop"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {ordinati.map((g, i) => (
            <div key={g.id} className="rounded-2xl bg-card p-3 shadow-card">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary font-display text-base">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {g.nome}
                      {i === 0 ? <Crown className="ml-1 inline h-3.5 w-3.5 text-warning" /> : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      #{g.numero} · {g.ruolo} · {g.streak} presenze consecutive
                    </p>
                  </div>
                </div>
                <span className="font-display text-xl tabular-nums">
                  {valore(g, criterio) || "—"}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-accent-grad"
                  style={{ width: `${Math.max(6, (valore(g, criterio) / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section titolo="Storico match">
        <div className="space-y-3">
          {tuttiMatch.map((m) => {
            const vinta = m.setNostri > m.setLoro;
            return (
              <article key={m.id} className="rounded-3xl bg-card p-4 shadow-card">
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
                <div className="mt-3 flex flex-wrap gap-1.5">
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
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      <Section titolo="Obiettivi di squadra">
        <div className="mb-3 rounded-3xl bg-hero p-4 text-primary-foreground shadow-card">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-foreground/60">
                Progresso collettivo
              </p>
              <p className="font-display text-4xl leading-none">
                <Numero valore={mediaObiettivi} suffisso="%" />
              </p>
            </div>
            <p className="text-xs text-primary-foreground/70">
              {completati}/{obiettivi.length} completati
            </p>
          </div>
          <Barra percentuale={mediaObiettivi} trackClassName="mt-3 bg-primary-foreground/15" />
        </div>
        <div className="space-y-2">
          {obiettivi.map((o, i) => {
            const pct = progressoObiettivo(o);
            const fatto = pct >= 100;
            return (
              <Reveal
                key={o.id}
                indice={i}
                className={cn(
                  "premi rounded-3xl bg-card p-4 shadow-card ring-1",
                  fatto ? "ring-success/40" : pct >= 90 ? "ring-accent/40" : "ring-transparent",
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none">{o.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight">{o.titolo}</p>
                    <p className="text-xs text-muted-foreground">{o.descrizione}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      fatto
                        ? "bg-success text-success-foreground"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {fatto ? "Completato" : `${pct}%`}
                  </span>
                </div>
                <Barra percentuale={pct} trackClassName="mt-3" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {o.valore}/{o.target} {o.unita} · {pct}%
                  {o.scadenza ? ` · entro il ${formatData(o.scadenza)}` : ""}
                </p>
                <p className="mt-1 text-xs font-semibold text-accent">{microcopyObiettivo(o)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{o.impatto}</p>
              </Reveal>
            );
          })}
        </div>
      </Section>

      <Section titolo="Badge sbloccabili">
        <div className="space-y-2">
          {badgeDefs.map((b) => {
            const Icon = b.icon;
            return (
              <BadgeDrawer key={b.id} def={b}>
                <div className="rounded-3xl bg-card p-3 shadow-card">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-accent" />
                    <p className="text-sm font-bold leading-tight">{b.nome}</p>
                    <p className="ml-auto text-[10px] text-muted-foreground">
                      {descrizioneSoglie(b)}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {gradiOrdine.map((grado) => {
                      const meta = gradoMeta[grado];
                      const quanti = rosa.filter((g) => {
                        const raggiunto = gradoRaggiunto(b, b.valore(g));
                        return raggiunto
                          ? gradiOrdine.indexOf(raggiunto) >= gradiOrdine.indexOf(grado)
                          : false;
                      }).length;
                      return (
                        <div
                          key={grado}
                          className={cn("rounded-2xl p-2 text-center ring-1", meta.bg, meta.ring)}
                        >
                          <p className={cn("text-[10px] font-bold uppercase", meta.text)}>
                            {meta.label}
                          </p>
                          <p className="font-display text-lg leading-none">{b.soglie[grado]}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {quanti}/{rosa.length}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </BadgeDrawer>
            );
          })}
        </div>
      </Section>
    </>
  );
}

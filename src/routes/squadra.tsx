import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Cake, ChevronDown, Crown, SlidersHorizontal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, Select, StatTile } from "@/components/crapp/ui-bits";
import { BarraSottosezioni } from "@/components/crapp/BarraSottosezioni";
import { Avatar } from "@/components/crapp/Avatar";
import { formatData } from "@/lib/crapp-data";
import { microcopyObiettivo, progressoObiettivo } from "@/lib/obiettivi";
import { useRosa, useObiettivi } from "@/lib/rosa";
import { usePresenzeUltimoMeseTutti } from "@/lib/presenze-mese";
import { totaliSquadra, useScoutMatches } from "@/lib/scout-store";
import { useCsi } from "@/lib/csi";
import { partiteGiocate } from "@/lib/csi-core";
import { mediaSquadra, usePagelle } from "@/lib/pagelle";
import { Reveal } from "@/components/motion/Reveal";
import { Barra } from "@/components/motion/Barra";
import { Numero } from "@/components/motion/Numero";
import { BadgeDrawer } from "@/components/crapp/BadgeDrawer";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
    <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-accent-foreground">
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
  { id: "cacchePartita", label: "Cacche" },
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
  const { voti: pagelle } = usePagelle();
  const [aperto, setAperto] = useState<string | null>(null);
  const [criterio, setCriterio] = useState<Criterio>("presenze");
  const [filtroAperto, setFiltroAperto] = useState(false);
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
  const matchGiocati = csi ? partiteGiocate(csi.partite).length : scoutMatches.length;
  const completati = obiettivi.filter((o) => progressoObiettivo(o) >= 100).length;
  const mediaObiettivi = obiettivi.length
    ? Math.round(obiettivi.reduce((s, o) => s + progressoObiettivo(o), 0) / obiettivi.length)
    : 0;

  return (
    <>
      <PageHeader titolo="Squadra" sottotitolo={`${rosa.length} giocatori · Stagione 2026/27`} />

      <BarraSottosezioni
        defaultId="rosa"
        variante="sottolineatura"
        voci={[
          {
            id: "rosa",
            label: "Rosa",
            contenuto: (
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
                        className="flex min-h-11 w-full items-center gap-3 p-3 text-left active:scale-[0.99]"
                        aria-expanded={isOpen}
                      >
                        <Avatar
                          id={g.id}
                          fallback={g.numero ? String(g.numero) : g.iniziali}
                          className="h-11 w-11 text-lg"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold leading-tight">
                            {g.nome}
                          </span>
                          <span className="mt-1 flex items-center gap-2">
                            <RuoloBadge ruolo={g.ruolo} />
                            <span className="text-xs text-muted-foreground">
                              {g.numero ? `#${g.numero}` : "n° da definire"}
                            </span>
                          </span>
                        </span>
                        {sbloccati.length > 0 ? (
                          <span className="flex max-w-[74px] shrink-0 flex-wrap items-center justify-end gap-0.5">
                            {sbloccati.map((b) => {
                              const Icon = b.def.icon;
                              return (
                                <span
                                  key={b.def.id}
                                  title={`${b.def.nome} — ${gradoMeta[b.grado!].label}`}
                                >
                                  <Icon
                                    className={cn("h-3.5 w-3.5", gradoMeta[b.grado!].text)}
                                    aria-hidden="true"
                                  />
                                  <span className="sr-only">
                                    {b.def.nome}: {gradoMeta[b.grado!].label}
                                  </span>
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
                                <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">
                                  {s.l}
                                </p>
                              </div>
                            ))}
                          </div>

                          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            Badge sbloccati · {collezioneBadge(g).ottenuti}/
                            {collezioneBadge(g).totali}
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
                                    <div
                                      className={cn("rounded-2xl p-2.5 ring-1", meta.bg, meta.ring)}
                                    >
                                      <Icon className={cn("h-4 w-4", meta.text)} />
                                      <p className="mt-1 text-xs font-bold leading-tight">
                                        {b.def.nome}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {b.valore} {b.def.unita}
                                        {b.prossimaSoglia
                                          ? ` · ${b.prossimaSoglia} per ${gradoMeta[b.prossimo!].label.toLowerCase()}`
                                          : ""}
                                      </p>
                                      <p
                                        className={cn(
                                          "mt-1.5 text-xs font-bold uppercase",
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
            ),
          },
          {
            id: "stats",
            label: "Statistiche",
            contenuto: (
              <div className="grid grid-cols-3 gap-2">
                <StatTile valore={`${mediaPresenze}%`} label="Media presenze" />
                <StatTile valore={matchGiocati} label="Match giocati" />
                <StatTile valore={mediaSquadra(pagelle) || "—"} label="Media pagelle" />
                <StatTile valore={team.punti} label="Punti squadra" />
                <StatTile valore={team.ace} label="Ace squadra" />
                <StatTile valore={team.muri} label="Muri squadra" />
              </div>
            ),
          },
          {
            id: "classifica-giocatori",
            label: "Classifica",
            nascondiTitolo: true,
            contenuto: (
              <>
                <div className="flex min-w-0 items-center gap-2 border-b border-border bg-card px-5 py-2.5">
                  <Trophy className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                  <span className="shrink-0 text-sm text-foreground/80">Classifica per</span>
                  <span className="min-w-0 flex-1">
                    <Select
                      value={criterio}
                      onChange={(e) => setCriterio(e.target.value as Criterio)}
                      aria-label="Criterio della classifica interna"
                      className="h-9 rounded-lg border-border bg-background font-semibold shadow-none"
                    >
                      {criteri.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiltroAperto(true)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground"
                    aria-label="Scegli criterio classifica"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </div>

                <Drawer open={filtroAperto} onOpenChange={setFiltroAperto}>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Classifica per</DrawerTitle>
                    </DrawerHeader>
                    <div className="flex flex-col gap-1 px-4 pb-6">
                      {criteri.map((c) => (
                        <DrawerClose key={c.id} asChild>
                          <button
                            type="button"
                            onClick={() => setCriterio(c.id)}
                            className={cn(
                              "flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-bold",
                              criterio === c.id
                                ? "bg-accent text-accent-foreground"
                                : "bg-secondary text-foreground",
                            )}
                          >
                            {c.label}
                          </button>
                        </DrawerClose>
                      ))}
                    </div>
                  </DrawerContent>
                </Drawer>

                <div className="space-y-2 px-5 pt-3">
                  {ordinati.map((g, i) => (
                    <div key={g.id} className="rounded-2xl bg-card p-3 shadow-card">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary font-display text-base">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">
                              {g.nome}
                              {i === 0 ? (
                                <Crown className="ml-1 inline h-3.5 w-3.5 text-warning" />
                              ) : null}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              #{g.numero} · {g.ruolo} · {g.streak} presenze consecutive
                            </p>
                          </div>
                        </div>
                        <span className="font-display text-xl tabular-nums">
                          {valore(g, criterio) || "—"}
                        </span>
                      </div>
                      <Barra
                        percentuale={Math.max(6, (valore(g, criterio) / max) * 100)}
                        altezza="h-1.5"
                        trackClassName="mt-2"
                      />
                    </div>
                  ))}
                </div>
              </>
            ),
          },
          {
            id: "obiettivi",
            label: "Obiettivi",
            contenuto: (
              <>
                <div className="mb-3 rounded-3xl bg-hero p-4 text-primary-foreground shadow-card">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/60">
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
                  <Barra
                    percentuale={mediaObiettivi}
                    trackClassName="mt-3 bg-primary-foreground/15"
                  />
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
                          fatto
                            ? "ring-success/40"
                            : pct >= 90
                              ? "ring-accent/40"
                              : "ring-transparent",
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
                              "rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
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
                        <p className="mt-1 text-xs font-semibold text-accent">
                          {microcopyObiettivo(o)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{o.impatto}</p>
                      </Reveal>
                    );
                  })}
                </div>
              </>
            ),
          },
          {
            id: "badge",
            label: "Badge",
            contenuto: (
              <div className="space-y-2">
                {badgeDefs.map((b) => {
                  const Icon = b.icon;
                  return (
                    <BadgeDrawer key={b.id} def={b}>
                      <div className="rounded-3xl bg-card p-3 shadow-card">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-accent" />
                          <p className="text-sm font-bold leading-tight">{b.nome}</p>
                          <p className="ml-auto text-xs text-muted-foreground">
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
                                className={cn(
                                  "rounded-2xl p-2 text-center ring-1",
                                  meta.bg,
                                  meta.ring,
                                )}
                              >
                                <p className={cn("text-xs font-bold uppercase", meta.text)}>
                                  {meta.label}
                                </p>
                                <p className="font-display text-lg leading-none">
                                  {b.soglie[grado]}
                                </p>
                                <p className="text-xs text-muted-foreground">
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
            ),
          },
        ]}
      />
    </>
  );
}

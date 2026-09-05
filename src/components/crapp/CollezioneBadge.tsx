import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Giocatore } from "@/lib/crapp-data";
import {
  collezioneBadge,
  gradoMeta,
  iconaSegreto as Lucchetto,
  mancanoPer,
  microcopyBadge,
  prossimoTraguardo,
  type BadgeStato,
} from "@/lib/badges";
import {
  badgeSocialVinti,
  categorieSocial,
  type VotoSocial,
  type CategoriaSocial,
} from "@/lib/badge-social";
import { Reveal } from "@/components/motion/Reveal";
import { Barra } from "@/components/motion/Barra";
import { Numero } from "@/components/motion/Numero";
import { BadgeDrawer } from "@/components/crapp/BadgeDrawer";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

function CardBadge({ b, opaco, indice = 0 }: { b: BadgeStato; opaco?: boolean; indice?: number }) {
  const Icon = b.def.icon;
  const meta = b.grado ? gradoMeta[b.grado] : null;
  return (
    <Reveal
      indice={indice}
      className={cn(
        "premi rounded-2xl p-3 shadow-card ring-1",
        meta ? `${meta.bg} ${meta.ring}` : "bg-card ring-border",
        opaco && "opacity-90",
      )}
    >
      <div className="flex items-center justify-between">
        <Icon className={cn("h-6 w-6", meta ? meta.text : "text-muted-foreground/50")} />
        {meta ? (
          <span className={cn("text-xs font-bold uppercase", meta.text)}>{meta.label}</span>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm font-bold leading-tight">{b.def.nome}</p>
      <p className="text-xs text-muted-foreground">
        {b.valore} {b.def.unita}
      </p>
      {b.prossimaSoglia ? (
        <>
          <Barra percentuale={b.progresso} altezza="h-1.5" trackClassName="mt-2" />
          <p className="mt-1 text-xs font-semibold text-accent">{mancanoPer(b)}</p>
          <p className="text-xs text-muted-foreground">{microcopyBadge(b)}</p>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{microcopyBadge(b)}</p>
      )}
    </Reveal>
  );
}

function SocialDrawer({
  cat,
  conteggio,
  children,
}: {
  cat: CategoriaSocial;
  conteggio: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="sr-only">
          <DrawerTitle>{cat.nome}</DrawerTitle>
          <DrawerDescription>{cat.descrizione}</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 p-4 pt-0">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent/15 text-2xl ring-1 ring-accent/30">
              {cat.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <DrawerTitle className="text-xl font-bold leading-tight">{cat.nome}</DrawerTitle>
              <DrawerDescription className="mt-1 text-sm leading-relaxed">
                {cat.descrizione}
              </DrawerDescription>
            </div>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Vinto</p>
            <p className="mt-1 font-display text-3xl leading-none">
              {conteggio}{" "}
              <span className="text-lg text-muted-foreground">
                {conteggio === 1 ? "volta" : "volte"}
              </span>
            </p>
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-2 p-4">
          <DrawerClose asChild>
            <button
              type="button"
              className="w-full rounded-2xl bg-secondary py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80"
            >
              Indietro
            </button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Sezione "Collezione badge": sbloccati, in progresso e segreti. */
export function CollezioneBadge({
  g,
  votiSocial = [],
}: {
  g: Giocatore;
  votiSocial?: VotoSocial[];
}) {
  const c = collezioneBadge(g);
  const vicino = prossimoTraguardo(g);
  const social = badgeSocialVinti(votiSocial, g.id);
  const socialVinti = categorieSocial.filter((cat) => social[cat.id]);
  const pct = Math.round((c.ottenuti / c.totali) * 100);

  return (
    <div className="space-y-3">
      <div className="rounded-3xl bg-hero p-4 text-primary-foreground shadow-card">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/60">
              Collezione badge
            </p>
            <p className="font-display text-4xl leading-none">
              <Numero valore={c.ottenuti} />
              <span className="text-2xl text-primary-foreground/50">/{c.totali}</span>
            </p>
          </div>
          <p className="text-xs text-primary-foreground/70">
            <Numero valore={pct} suffisso="%" /> completata
          </p>
        </div>
        <Barra percentuale={pct} trackClassName="mt-3 bg-primary-foreground/15" />
      </div>

      {vicino ? (
        <div className="rounded-3xl bg-card p-4 shadow-card ring-1 ring-accent/30">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">
            Prossimo traguardo
          </p>
          <p className="mt-1 text-sm font-bold leading-tight">{vicino.def.nome}</p>
          <Barra percentuale={vicino.progresso} trackClassName="mt-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {mancanoPer(vicino)} · {microcopyBadge(vicino)}
          </p>
        </div>
      ) : null}

      {c.sbloccati.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Sbloccati ({c.sbloccati.length})
          </p>
          <div className="grid grid-cols-2 gap-2">
            {c.sbloccati.map((b, i) => (
              <BadgeDrawer key={b.def.id} def={b.def} stato={b}>
                <CardBadge b={b} indice={i} />
              </BadgeDrawer>
            ))}
          </div>
        </div>
      ) : null}

      {c.inProgresso.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            In progresso ({c.inProgresso.length})
          </p>
          <div className="grid grid-cols-2 gap-2">
            {c.inProgresso.map((b, i) => (
              <BadgeDrawer key={b.def.id} def={b.def} stato={b}>
                <CardBadge b={b} opaco indice={i} />
              </BadgeDrawer>
            ))}
          </div>
        </div>
      ) : null}

      {socialVinti.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Votati dai compagni
          </p>
          <div className="grid grid-cols-2 gap-2">
            {socialVinti.map((cat) => (
              <SocialDrawer key={cat.id} cat={cat} conteggio={social[cat.id] ?? 0}>
                <div className="rounded-2xl bg-card p-3 shadow-card ring-1 ring-accent/25">
                  <p className="text-lg leading-none">{cat.emoji}</p>
                  <p className="mt-1 text-sm font-bold leading-tight">{cat.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Vinto {social[cat.id]} {social[cat.id] === 1 ? "volta" : "volte"}
                  </p>
                </div>
              </SocialDrawer>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Badge segreti
        </p>
        <div className="grid grid-cols-2 gap-2">
          {c.segreti.map((b) => {
            const Icon = b.def.icon;
            return (
              <BadgeDrawer key={b.def.id} def={b.def} stato={b}>
                <div className="rounded-2xl bg-card p-3 shadow-card ring-1 ring-oro/40">
                  <Icon className="h-6 w-6 text-oro" />
                  <p className="mt-1.5 text-sm font-bold leading-tight">{b.def.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.def.celebrazione ?? "Badge segreto sbloccato."}
                  </p>
                </div>
              </BadgeDrawer>
            );
          })}
          {Array.from({ length: c.nascosti }).map((_, i) => (
            <div
              key={`nascosto-${i}`}
              className="grid place-items-center rounded-2xl bg-secondary/60 p-3 text-center"
            >
              <Lucchetto className="h-6 w-6 text-muted-foreground/50" />
              <p className="mt-1.5 text-sm font-bold leading-tight text-muted-foreground">???</p>
              <p className="text-xs text-muted-foreground/70">Badge segreto da scoprire</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

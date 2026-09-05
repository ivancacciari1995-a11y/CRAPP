import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BadgeDef, BadgeStato, Grado } from "@/lib/badges";
import { gradoMeta, gradiOrdine, descrizioneSoglie } from "@/lib/badges";
import { Barra } from "@/components/motion/Barra";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

function DettaglioBadge({ def, stato }: { def: BadgeDef; stato?: BadgeStato }) {
  const Icon = def.icon;
  const grado = stato?.grado ?? null;
  const meta = grado ? gradoMeta[grado] : null;
  const prossimo = stato?.prossimo ?? null;

  return (
    <div className="space-y-4 p-4 pt-0">
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "grid h-14 w-14 shrink-0 place-items-center rounded-2xl ring-1",
            meta ? `${meta.bg} ${meta.ring}` : "bg-secondary ring-border",
          )}
        >
          <Icon className={cn("h-7 w-7", meta ? meta.text : "text-muted-foreground")} />
        </span>
        <div className="min-w-0 flex-1">
          <DrawerTitle className="text-xl font-bold leading-tight">{def.nome}</DrawerTitle>
          <DrawerDescription className="mt-1 text-sm leading-relaxed">
            {def.descrizione}
          </DrawerDescription>
        </div>
      </div>

      {stato ? (
        <div className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Stato attuale
            </p>
            {grado ? (
              <span className={cn("text-xs font-bold uppercase", meta?.text)}>{meta?.label}</span>
            ) : (
              <span className="text-xs font-bold uppercase text-muted-foreground">
                In progresso
              </span>
            )}
          </div>
          <p className="mt-1 font-display text-3xl leading-none">
            {stato.valore} <span className="text-lg text-muted-foreground">{def.unita}</span>
          </p>
          {stato.prossimaSoglia ? (
            <>
              <Barra percentuale={stato.progresso} trackClassName="mt-3" />
              <p className="mt-2 text-xs text-muted-foreground">
                Mancano {stato.prossimaSoglia - stato.valore} {def.unita} per il{" "}
                {gradoMeta[stato.prossimo as Grado].label.toLowerCase()}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-success">Hai raggiunto il livello massimo.</p>
          )}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Soglie
        </p>
        <div className="grid grid-cols-3 gap-2">
          {gradiOrdine.map((g) => {
            const gm = gradoMeta[g];
            const raggiunto = grado ? gradiOrdine.indexOf(grado) >= gradiOrdine.indexOf(g) : false;
            return (
              <div
                key={g}
                className={cn(
                  "rounded-2xl p-3 text-center ring-1",
                  raggiunto ? `${gm.bg} ${gm.ring}` : "bg-secondary ring-border",
                )}
              >
                <p
                  className={cn(
                    "text-xs font-bold uppercase",
                    raggiunto ? gm.text : "text-muted-foreground",
                  )}
                >
                  {gm.label}
                </p>
                <p
                  className={cn(
                    "font-display text-xl leading-none",
                    raggiunto ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {def.soglie[g]}
                </p>
                <p className="text-xs text-muted-foreground">{def.unita}</p>
              </div>
            );
          })}
        </div>
      </div>

      {def.celebrazione ? (
        <p className="rounded-2xl bg-accent/10 p-3 text-center text-sm font-semibold text-accent">
          “{def.celebrazione}”
        </p>
      ) : null}
    </div>
  );
}

/** Drawer cliccabile che mostra la descrizione e le soglie di un badge. */
export function BadgeDrawer({
  def,
  stato,
  children,
}: {
  def: BadgeDef;
  stato?: BadgeStato;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="sr-only">
          <DrawerTitle>{def.nome}</DrawerTitle>
          <DrawerDescription>{def.descrizione}</DrawerDescription>
        </DrawerHeader>
        <DettaglioBadge def={def} {...(stato ? { stato } : {})} />
        <DrawerFooter>
          <DrawerClose asChild>
            <button
              type="button"
              className="w-full rounded-2xl bg-secondary py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80"
            >
              Indietro
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

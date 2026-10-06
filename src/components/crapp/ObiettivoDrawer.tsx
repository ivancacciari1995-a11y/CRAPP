import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatData } from "@/lib/crapp-data";
import { microcopyObiettivo, progressoObiettivo, type ObiettivoSquadra } from "@/lib/obiettivi";
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

function Elenco({ titolo, voci, segno }: { titolo: string; voci: string[]; segno: string }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
        {titolo}
      </p>
      <ul className="space-y-1.5">
        {voci.map((v) => (
          <li key={v} className="flex gap-2 text-[15px] leading-snug">
            <span aria-hidden className="shrink-0 font-bold text-accent">
              {segno}
            </span>
            <span>{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Blocco({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div>
      <p className="mb-1 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
        {titolo}
      </p>
      <p className="text-[15px] leading-relaxed">{testo}</p>
    </div>
  );
}

/** Corpo della card di dettaglio; esportato per i test, va usato dentro un Drawer. */
export function SchedaObiettivo({ o }: { o: ObiettivoSquadra }) {
  const pct = progressoObiettivo(o);
  const fatto = pct >= 100;
  const d = o.dettaglio;
  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4 pt-0">
      <div className="flex items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl ring-1 ring-border">
          {o.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <DrawerTitle className="text-xl font-bold leading-tight">{o.titolo}</DrawerTitle>
          <DrawerDescription className="mt-1 text-[15px] leading-relaxed">
            {o.descrizione}
          </DrawerDescription>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
            Stato attuale
          </p>
          <span
            className={cn(
              "text-[13px] font-bold uppercase",
              fatto ? "text-success" : "text-muted-foreground",
            )}
          >
            {fatto ? "Completato" : "In corso"}
          </span>
        </div>
        <p className="mt-1 font-display text-3xl leading-none">
          {o.valore} <span className="text-lg text-muted-foreground">su {o.target}</span>{" "}
          <span className="text-lg text-muted-foreground">{o.unita}</span>
        </p>
        <Barra percentuale={pct} trackClassName="mt-3" />
        <p className="mt-2 text-[13px] text-muted-foreground">
          {pct}%{o.scadenza ? ` · entro il ${formatData(o.scadenza)}` : ""}
        </p>
        <p className="mt-1 text-[13px] font-semibold text-accent">{microcopyObiettivo(o)}</p>
      </div>

      <Blocco titolo="Come si calcola" testo={d.comeSiCalcola} />
      <Elenco titolo="Cosa conta" voci={d.conta} segno="+" />
      {d.perse ? <Elenco titolo="Presenza persa" voci={d.perse} segno="−" /> : null}
      <Elenco
        titolo={d.perse ? "Non entra nel calcolo" : "Cosa non conta"}
        voci={d.nonConta}
        segno={d.perse ? "·" : "−"}
      />
      <Blocco titolo="Quando vale" testo={d.periodo} />
      <Blocco titolo="Da dove arrivano i dati" testo={d.fonte} />
      <Blocco titolo="Un esempio" testo={d.esempio} />

      <p className="rounded-2xl bg-accent/10 p-3 text-center text-[15px] font-semibold text-accent">
        {o.impatto}
      </p>
    </div>
  );
}

/** Drawer cliccabile che spiega nel dettaglio un obiettivo di squadra. */
export function ObiettivoDrawer({
  obiettivo,
  children,
}: {
  obiettivo: ObiettivoSquadra;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="sr-only">
          <DrawerTitle>{obiettivo.titolo}</DrawerTitle>
          <DrawerDescription>{obiettivo.descrizione}</DrawerDescription>
        </DrawerHeader>
        <SchedaObiettivo o={obiettivo} />
        <DrawerFooter>
          <DrawerClose asChild>
            <button
              type="button"
              className="w-full rounded-2xl bg-secondary py-3 text-[15px] font-semibold text-foreground transition-colors hover:bg-secondary/80"
            >
              Indietro
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

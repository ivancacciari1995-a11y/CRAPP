import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { statoMeta, type Stato } from "@/lib/crapp-data";
import { Reveal } from "@/components/motion/Reveal";
import { Numero } from "@/components/motion/Numero";

export function TeamLogo({ className }: { className?: string }) {
  return (
    <img
      src="/icon-192.png"
      alt="CRAP Volley"
      className={cn("shrink-0 rounded-2xl object-cover shadow-pop", className)}
    />
  );
}

export function PageHeader({ titolo, sottotitolo }: { titolo: string; sottotitolo?: string }) {
  return (
    <header className="bg-hero px-5 pb-8 pt-7 text-primary-foreground">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl uppercase">{titolo}</h1>
          {sottotitolo ? (
            <p className="mt-1 truncate text-sm text-primary-foreground/70">{sottotitolo}</p>
          ) : null}
        </div>
        <TeamLogo className="h-11 w-11" />
      </div>
    </header>
  );
}

export function Section({
  titolo,
  azione,
  children,
  indice = 0,
}: {
  titolo: string;
  azione?: ReactNode;
  children: ReactNode;
  indice?: number;
}) {
  return (
    <Reveal as="section" indice={indice} className="px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg uppercase tracking-wide">{titolo}</h2>
        {azione}
      </div>
      {children}
    </Reveal>
  );
}

/** Sezione con titolo cliccabile: il contenuto si apre e chiude. `anteprima` resta sempre visibile. */
export function SezioneTendina({
  titolo,
  children,
  anteprima,
  azione,
  defaultAperta = false,
  indice = 0,
}: {
  titolo: string;
  children: ReactNode;
  anteprima?: ReactNode;
  azione?: ReactNode;
  defaultAperta?: boolean;
  indice?: number;
}) {
  const [aperta, setAperta] = useState(defaultAperta);
  return (
    <Reveal as="section" indice={indice} className="px-5 py-4">
      <button
        type="button"
        onClick={() => setAperta((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-3 text-left active:scale-[0.99]"
        aria-expanded={aperta}
      >
        <h2 className="font-display text-lg uppercase tracking-wide">{titolo}</h2>
        <span className="flex shrink-0 items-center gap-2">
          {azione}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              aperta && "rotate-180",
            )}
          />
        </span>
      </button>
      {anteprima}
      {aperta ? children : null}
    </Reveal>
  );
}

export function StatoBadge({ stato, className }: { stato: Stato; className?: string }) {
  const meta = statoMeta[stato];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function StatTile({
  valore,
  label,
  hint,
}: {
  valore: ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <div className="premi rounded-2xl bg-card p-3 shadow-card">
      <p className="font-display text-2xl leading-none">
        {typeof valore === "number" ? <Numero valore={valore} /> : valore}
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-accent">{hint}</p> : null}
    </div>
  );
}

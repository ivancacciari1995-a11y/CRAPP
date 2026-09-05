import { useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { statoMeta, type Stato } from "@/lib/crapp-data";
import { useIo } from "@/lib/rosa";
import { Avatar } from "@/components/crapp/Avatar";
import { Reveal } from "@/components/motion/Reveal";
import { Numero } from "@/components/motion/Numero";

export function TeamLogo({ className }: { className?: string }) {
  return (
    <img
      src="/icon-192.png"
      alt="CRAP Volley"
      width={192}
      height={192}
      className={cn("shrink-0 rounded-2xl object-cover shadow-pop", className)}
    />
  );
}

/**
 * Superficie standard dell'app: era ripetuta a mano una ventina di volte come
 * `rounded-3xl bg-card p-4 shadow-card`, quindi cambiare raggio od ombra
 * voleva dire toccare venti file.
 *
 * Gerarchia dei raggi: contenitore `3xl` → elemento interno `2xl` →
 * controllo `full`.
 */
export function Card({
  className,
  as: Tag = "div",
  ...props
}: ComponentPropsWithoutRef<"div"> & { as?: "div" | "article" | "section" }) {
  return <Tag className={cn("premi rounded-3xl bg-card p-4 shadow-card", className)} {...props} />;
}

/**
 * Accesso al profilo in alto a destra: la BottomNav ha quattro voci e questa è
 * l'unica porta verso `/profilo`. Sulla pagina del profilo si passa `azione` a
 * `PageHeader` per rimetterci il logo — sarebbe un link a sé stessa.
 */
export function LinkProfilo() {
  const g = useIo();
  if (!g) return <TeamLogo className="h-11 w-11" />;
  return (
    <Link
      to="/profilo"
      aria-label="Il tuo profilo"
      className="premi shrink-0 rounded-2xl ring-2 ring-primary-foreground/30"
    >
      <Avatar id={g.id} fallback={g.iniziali} className="h-11 w-11 text-lg" />
    </Link>
  );
}

export function PageHeader({
  titolo,
  sottotitolo,
  azione,
}: {
  titolo: string;
  sottotitolo?: string;
  /** Sostituisce il link al profilo in alto a destra. */
  azione?: ReactNode;
}) {
  return (
    <header className="bg-hero px-5 pb-8 pt-7 text-primary-foreground">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display-lg text-3xl uppercase">{titolo}</h1>
          {sottotitolo ? (
            <p className="mt-1 truncate text-sm text-primary-foreground/80">{sottotitolo}</p>
          ) : null}
        </div>
        {azione ?? <LinkProfilo />}
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
        <h2 className="font-display-sm text-lg uppercase">{titolo}</h2>
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
  const id = useId();
  return (
    <Reveal as="section" indice={indice} className="px-5 py-4">
      <button
        type="button"
        onClick={() => setAperta((v) => !v)}
        className="mb-3 flex min-h-11 w-full items-center justify-between gap-3 text-left active:scale-[0.99]"
        aria-expanded={aperta}
        aria-controls={id}
      >
        <h2 className="font-display-sm text-lg uppercase">{titolo}</h2>
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
      <div id={id}>{aperta ? children : null}</div>
    </Reveal>
  );
}

export function StatoBadge({ stato, className }: { stato: Stato; className?: string }) {
  const meta = statoMeta[stato];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase",
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
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-accent">{hint}</p> : null}
    </div>
  );
}

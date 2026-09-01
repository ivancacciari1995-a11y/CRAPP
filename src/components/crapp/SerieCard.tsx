import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Giocatore } from "@/lib/crapp-data";
import { serieGiocatore, serieMigliore } from "@/lib/serie";
import { Barra } from "@/components/motion/Barra";
import { Reveal } from "@/components/motion/Reveal";

/** Griglia completa delle serie di presenza (profilo). */
export function SerieGriglia({ g }: { g: Giocatore }) {
  const serie = serieGiocatore(g);
  return (
    <div className="space-y-2">
      {serie.map((s, i) => {
        const Icon = s.def.icon;
        const attiva = s.valore > 0;
        return (
          <Reveal key={s.def.tipo} indice={i} className="premi rounded-3xl bg-card p-4 shadow-card">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
                  attiva
                    ? "bg-accent-grad text-accent-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">{s.def.label}</p>
                <p className="text-[11px] text-muted-foreground">{s.def.descrizione}</p>
              </div>
              <span className="inline-flex items-center gap-1 font-display text-2xl leading-none">
                <Flame
                  className={cn("h-4 w-4", attiva ? "text-accent" : "text-muted-foreground/40")}
                />
                {s.valore}
              </span>
            </div>
            <Barra percentuale={s.progresso} trackClassName="mt-3" />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {s.prossimo ? `${s.valore}/${s.prossimo} · ` : ""}
              {s.messaggio}
            </p>
          </Reveal>
        );
      })}
    </div>
  );
}

/** Riepilogo compatto per la home. */
export function SerieHome({ g }: { g: Giocatore }) {
  const top = serieMigliore(g);
  const Icon = top.def.icon;
  return (
    <div className="rounded-3xl bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-grad text-accent-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">
            Serie {top.def.label.toLowerCase()}: {top.valore}
          </p>
          <p className="text-[11px] text-muted-foreground">{top.messaggio}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {serieGiocatore(g).map((s) => (
          <div key={s.def.tipo} className="rounded-2xl bg-secondary p-2 text-center">
            <p className="font-display text-xl leading-none">{s.valore}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase text-muted-foreground">
              {s.def.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

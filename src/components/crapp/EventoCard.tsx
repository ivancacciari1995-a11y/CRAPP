import { MapPin, Clock, Users, Cake, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { formatData, statoMeta, type Stato } from "@/lib/crapp-data";
import type { Evento } from "@/lib/eventi";
import { Barra } from "@/components/motion/Barra";
import { useGiocatoriSquadra } from "@/lib/giocatori-squadra";
import { usePresenzeEvento, useSalvaPresenza } from "@/lib/presenze";
import { useGiocatoreCorrente } from "@/lib/user-store";

const tipoMeta = {
  partita: { label: "Partita", className: "bg-accent text-accent-foreground" },
  allenamento: { label: "Allenamento", className: "bg-training text-training-foreground" },
  evento: { label: "Eventi", className: "bg-warning text-warning-foreground" },
  compleanno: { label: "Compleanno", className: "bg-success text-success-foreground" },
} as const;

const stati: Stato[] = ["presente", "forse", "ritardo", "assente", "infortunato"];

export function linkPerEvento(e: Evento) {
  if (e.tipo === "partita") {
    return { to: "/partita/$id", params: { id: e.id }, label: "Apri partita" };
  }
  if (e.tipo === "allenamento") {
    return { to: "/allenamento/$id", params: { id: e.id }, label: "Apri allenamento" };
  }
  return undefined;
}

export function EventoCard({
  evento,
  linkTo,
}: {
  evento: Evento;
  linkTo?: { to: string; params: Record<string, string>; label: string };
}) {
  const { risposte } = usePresenzeEvento(evento.id);
  const salva = useSalvaPresenza();
  const io = useGiocatoreCorrente();
  const { righe: squadra } = useGiocatoriSquadra();
  const rosa = squadra.filter((g) => g.attivo);
  const stato = io ? risposte[io.id] : undefined;
  const presentiVeri = rosa.filter(
    (g) => risposte[g.id] === "presente" || risposte[g.id] === "ritardo",
  ).length;
  const tipo =
    evento.tipo === "partita" && !evento.campionato
      ? { label: "Amichevole", className: "bg-accent/70 text-accent-foreground" }
      : tipoMeta[evento.tipo];
  const totale = rosa.length;
  const perc = totale ? Math.round((presentiVeri / totale) * 100) : 0;
  const isCompleanno = evento.tipo === "compleanno";

  if (isCompleanno) {
    return (
      <article className="premi flex items-center gap-3 rounded-3xl bg-card p-4 shadow-card">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-success/15 text-success">
          <Cake className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold leading-tight">{evento.titolo}</h3>
          <p className="text-xs text-muted-foreground">{evento.luogo}</p>
        </div>
        <div className="shrink-0 rounded-2xl bg-secondary px-3 py-2 text-center">
          <p className="font-display text-xl leading-none">{evento.data.slice(8, 10)}</p>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
            {formatData(evento.data).split(" ")[2]?.slice(0, 3)}
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="premi rounded-3xl bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={cn(
              "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              tipo.className,
            )}
          >
            {tipo.label}
          </span>
          <h3 className="mt-2 text-base font-bold leading-tight">{evento.titolo}</h3>
        </div>
        <div className="shrink-0 rounded-2xl bg-secondary px-3 py-2 text-center">
          <p className="font-display text-xl leading-none">{evento.data.slice(8, 10)}</p>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
            {formatData(evento.data).split(" ")[2]?.slice(0, 3)}
          </p>
        </div>
      </div>

      {linkTo && (
        <div className="mt-2 flex justify-end">
          <Link
            to={linkTo.to}
            params={linkTo.params}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground transition-transform active:scale-95"
          >
            {linkTo.label} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {evento.ora}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{evento.luogo}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {presentiVeri}/{totale}
        </span>
      </div>

      <Barra percentuale={perc} altezza="h-1.5" trackClassName="mt-3" />

      {io ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {stati.map((s) => {
            const meta = statoMeta[s];
            const attivo = stato === s;
            return (
              <button
                key={s}
                type="button"
                disabled={salva.isPending}
                onClick={() =>
                  salva.mutate({
                    eventoId: evento.id,
                    giocatoreId: io.id,
                    stato: attivo ? null : s,
                  })
                }
                className={cn(
                  "rounded-full border border-border px-2.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95",
                  attivo
                    ? cn(meta.className, "border-transparent shadow-card")
                    : "bg-background text-muted-foreground",
                )}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

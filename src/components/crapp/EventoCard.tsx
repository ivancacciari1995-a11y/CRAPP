import {
  MapPin,
  Clock,
  Users,
  Cake,
  ChevronRight,
  Check,
  HelpCircle,
  X,
  Bandage,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Card } from "@/components/crapp/ui-bits";
import { formatData, statoMeta, type Stato } from "@/lib/crapp-data";
import type { Evento } from "@/lib/eventi";
import { useGiocatoriSquadra } from "@/lib/giocatori-squadra";
import { usePresenzeEvento, useSalvaPresenza } from "@/lib/presenze";
import { useGiocatoreBase } from "@/lib/user-store";
import { dataOggi } from "@/lib/scout-live";

const tipoMeta = {
  partita: { label: "Partita", className: "bg-accent text-accent-foreground" },
  allenamento: { label: "Allenamento", className: "bg-training text-training-foreground" },
  evento: { label: "Evento", className: "bg-warning text-warning-foreground" },
  compleanno: { label: "Compleanno", className: "bg-success text-success-foreground" },
} as const;

const statiSportivi: Stato[] = ["presente", "forse", "ritardo", "assente", "infortunato"];
/** Eventi extra-campo (pizze, uscite…): l'infortunio non è una risposta pertinente. */
const statiEventoExtra: Stato[] = ["presente", "forse", "ritardo", "assente"];

/** Icone compatte per la riga unica dei controlli presenza (mockup). */
const iconeStato: Record<Stato, typeof Check> = {
  presente: Check,
  forse: HelpCircle,
  ritardo: Clock,
  assente: X,
  /** Cerotto singolo: leggibile a 16px e allineato all'emoji 🩹. */
  infortunato: Bandage,
};

export function linkPerEvento(e: Evento) {
  if (e.tipo === "partita") {
    return { to: "/partita/$id" as const, params: { id: e.id }, label: "Dettaglio partita" };
  }
  if (e.tipo === "allenamento") {
    return {
      to: "/allenamento/$id" as const,
      params: { id: e.id },
      label: "Dettaglio allenamento",
    };
  }
  return undefined;
}

function etichettaData(iso: string) {
  const giorno = iso.slice(8, 10);
  const mese = formatData(iso).split(" ")[2]?.slice(0, 3)?.toUpperCase() ?? "";
  return `${giorno} ${mese}`;
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
  // Solo `io.id` serve qui (per leggere/scrivere la propria risposta): `useGiocatoreBase`
  // legge la sola anagrafica, non le statistiche di tutta la rosa di `useGiocatoreCorrente`.
  // Rilevante perché ogni card monta questo hook: il Calendario ne rende diverse insieme.
  const io = useGiocatoreBase();
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
  const isCompleanno = evento.tipo === "compleanno";
  const passato = evento.data < dataOggi();
  const cliccabile = Boolean(linkTo);
  /** Solo gli eventi extra-campo non hanno scheda dedicata: le note restano sulla card. */
  const noteCard =
    evento.tipo === "evento" ? evento.note.trim() : "";
  const stati =
    evento.tipo === "evento"
      ? // Se resta un vecchio "infortunato", mostra il bottone solo per poterlo togliere.
        stato === "infortunato"
        ? [...statiEventoExtra, "infortunato" as const]
        : statiEventoExtra
      : statiSportivi;

  if (isCompleanno) {
    return (
      <Card as="article" className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-success/15 text-success">
          <Cake className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold leading-tight">{evento.titolo}</h3>
          <p className="text-xs text-muted-foreground">{evento.luogo}</p>
        </div>
        <div className="shrink-0 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {etichettaData(evento.data)}
        </div>
      </Card>
    );
  }

  const sottotitoloPartita =
    evento.tipo === "partita"
      ? `${evento.casa ? "Casa" : "Trasferta"}${evento.campionato ? " · Campionato" : " · Amichevole"}`
      : null;
  const metaStato = stato ? statoMeta[stato] : null;

  return (
    <Card
      as="article"
      className={cn(
        "relative overflow-hidden p-0",
        cliccabile && "transition-transform active:scale-[0.99]",
      )}
    >
      {/* Link a tutta card: i controlli sopra (z-10) restano indipendenti. */}
      {linkTo ? (
        <Link
          to={linkTo.to}
          params={linkTo.params}
          aria-label={linkTo.label}
          className="absolute inset-0 z-0 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      ) : null}

      <div className={cn("relative z-10 p-4", linkTo && "pointer-events-none")}>
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",
              tipo.className,
            )}
          >
            {tipo.label}
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {etichettaData(evento.data)}
            {linkTo ? <ChevronRight className="h-4 w-4" aria-hidden /> : null}
          </span>
        </div>

        <h3 className="mt-2 text-base font-bold leading-tight">{evento.titolo}</h3>
        {sottotitoloPartita ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{sottotitoloPartita}</p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{evento.ora}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{evento.luogo}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {presentiVeri}/{totale}
            </span>
          </span>
        </div>

        {noteCard ? (
          <p className="mt-2.5 line-clamp-2 text-xs text-muted-foreground">📝 {noteCard}</p>
        ) : null}

        {metaStato ? (
          <p
            className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-left text-xs font-semibold text-muted-foreground"
            aria-live="polite"
          >
            <span aria-hidden>{metaStato.emoji}</span>
            <span>{metaStato.label}</span>
          </p>
        ) : null}

        {io ? (
          <div
            className={cn(
              "pointer-events-auto flex w-full gap-1",
              metaStato ? "mt-2.5" : "mt-3",
            )}
            role="group"
            aria-label="La tua presenza"
          >
            {stati.map((s) => {
              const meta = statoMeta[s];
              const Icon = iconeStato[s];
              const attivo = stato === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={salva.isPending || passato}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    salva.mutate({
                      eventoId: evento.id,
                      giocatoreId: io.id,
                      stato: attivo ? null : s,
                    });
                  }}
                  aria-pressed={attivo}
                  aria-label={meta.label}
                  title={meta.label}
                  className={cn(
                    "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl px-1 transition-all active:scale-95 disabled:opacity-50",
                    attivo
                      ? cn(meta.className, "shadow-card")
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

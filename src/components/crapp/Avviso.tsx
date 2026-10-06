import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";

/**
 * Gravità di un avviso in Home. Il colore non è l'unico segnale: ogni avviso ha anche un'icona
 * sua e un titolo, così si distingue anche senza vedere i colori.
 */
export type TonoAvviso = "critico" | "attenzione" | "scaduto" | "azione";

const toni: Record<TonoAvviso, string> = {
  critico: "bg-destructive text-destructive-foreground",
  attenzione: "bg-warning text-warning-foreground",
  scaduto: "bg-primary text-primary-foreground",
  azione: "bg-accent-grad text-accent-foreground",
};

/** Una riga di un elenco: a sinistra chi, a destra il dettaglio (es. la scadenza). */
export type RigaAvviso = { chi: string; cosa: string };

type ProprietaCorpo = {
  tono: TonoAvviso;
  icona: LucideIcon;
  titolo: string;
  /** Frasi di spiegazione, una per paragrafo. */
  testi?: string[];
  /** Elenco di persone con il loro dettaglio; con più di una riga compare il conteggio. */
  elenco?: RigaAvviso[];
  /** Mostra la freccia: tutta la card porta a un'altra schermata. */
  cliccabile?: boolean;
  /** Parola breve accanto al titolo (es. «Oggi»), per dire subito quando riguarda. */
  etichetta?: string;
  /** I testi in riquadri propri, uno per messaggio: per chi deve fare una cosa precisa. */
  riquadri?: boolean;
};

/** Contenuto dell'avviso, senza margini né link: è la parte che si può verificare nei test. */
export function CorpoAvviso({
  tono,
  icona: Icona,
  titolo,
  testi = [],
  elenco = [],
  cliccabile = false,
  etichetta,
  riquadri = false,
}: ProprietaCorpo) {
  return (
    <div className={cn("rounded-3xl p-5 shadow-pop", toni[tono])}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-current/15"
        >
          <Icona className="h-6 w-6" />
        </span>
        <p className="min-w-0 flex-1 font-display text-lg uppercase leading-tight tracking-wide">
          {titolo}
        </p>
        {etichetta ? (
          <span className="rounded-full bg-black/25 px-3 py-1 text-[13px] font-bold uppercase tracking-wide">
            {etichetta}
          </span>
        ) : null}
        {elenco.length > 1 ? (
          <span
            aria-label={`${elenco.length} persone`}
            className="rounded-full bg-current/15 px-3 py-1 text-[13px] font-bold tabular-nums"
          >
            {elenco.length}
          </span>
        ) : null}
        {cliccabile ? <ChevronRight aria-hidden className="h-6 w-6 shrink-0" /> : null}
      </div>

      {testi.map((t) => (
        <p
          key={t}
          className={cn(
            "mt-3 text-[15px] leading-snug",
            riquadri && "rounded-2xl bg-black/15 p-3.5 font-semibold",
          )}
        >
          {t}
        </p>
      ))}

      {elenco.length > 0 ? (
        <ul className="mt-3 divide-y divide-current/15 border-t border-current/15">
          {elenco.map((r) => (
            <li
              key={`${r.chi}-${r.cosa}`}
              className="flex items-baseline justify-between gap-3 py-2.5 text-[15px] leading-snug"
            >
              <span className="min-w-0 truncate font-semibold">{r.chi}</span>
              <span className="shrink-0 text-right tabular-nums">{r.cosa}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Avviso in Home: comparsa graduale, margini della colonna e, se serve, link ai documenti del
 * profilo. Tutti gli avvisi (certificati, turno palloni) passano da qui per avere lo stesso aspetto.
 */
export function Avviso({ indice = 0, ...corpo }: ProprietaCorpo & { indice?: number }) {
  const card = <CorpoAvviso {...corpo} />;
  return (
    <Reveal indice={indice} className="mx-5 mt-4">
      {corpo.cliccabile ? (
        <Link
          to="/profilo"
          search={{ tab: "documenti" }}
          className="premi block rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {card}
        </Link>
      ) : (
        <div role="status">{card}</div>
      )}
    </Reveal>
  );
}

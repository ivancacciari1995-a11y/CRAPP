import { useState } from "react";
import { BarChart3, Download, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/crapp/ui-bits";
import type { Giocatore } from "@/lib/crapp-data";
import { csvScoutMatch, scaricaCsv } from "@/lib/scout-export";
import {
  fondamentali,
  sintesiValutazioni,
  totaliPerGiocatore,
  totaliSquadra,
  type ScoutMatch,
} from "@/lib/scout-store";

const pct = (piu: number, meno: number) =>
  piu + meno === 0 ? null : Math.round((piu / (piu + meno)) * 100);

/** Lettura dello scout di una partita: squadra per fondamentale, set per set, dettaglio per giocatore. */
export function ScoutReport({
  scout,
  rosa,
  admin,
}: {
  scout: ScoutMatch;
  rosa: Giocatore[];
  admin: boolean;
}) {
  // undefined = tutta la partita.
  const [set, setSet] = useState<number | undefined>(undefined);
  const [guida, setGuida] = useState(false);
  const sets = [...new Set(scout.valutazioni.map((v) => v.set))].sort((a, b) => a - b);
  const { squadra, perGiocatore } = sintesiValutazioni(scout.valutazioni, set);
  const righe = perGiocatore
    .map((r) => ({ ...r, g: rosa.find((x) => x.id === r.giocatoreId) }))
    .filter((r): r is typeof r & { g: Giocatore } => !!r.g)
    .sort((a, b) => a.g.numero - b.g.numero);

  const azioni = totaliPerGiocatore(scout.azioni);
  const totaliAzioni = totaliSquadra([scout]);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" /> Valutazione scout
        </p>
        <button
          type="button"
          aria-expanded={guida}
          aria-label="Come leggere lo scout"
          onClick={() => setGuida((g) => !g)}
          className={cn(
            "premi flex h-8 w-8 items-center justify-center rounded-full transition-colors",
            guida ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
          )}
        >
          <Info className="h-4 w-4" />
        </button>
      </div>
      {guida ? (
        <dl className="mt-3 space-y-3 rounded-2xl bg-secondary p-4 text-[13px] leading-relaxed">
          {[
            [
              "Cosa misura",
              <>
                Durante la partita lo scout assegna a ciascun giocatore una valutazione{" "}
                <b className="text-success">+</b> (esecuzione positiva) o{" "}
                <b className="text-destructive">−</b> (esecuzione negativa) su quattro fondamentali:
                battuta, ricezione, attacco e muro. Sono giudizi qualitativi, non punti: non
                incidono su risultato, classifiche o badge.
              </>,
            ],
            [
              "Indicatori di squadra",
              <>
                Ogni scheda riporta, per fondamentale, la percentuale di valutazioni positive (+ ÷
                (+ + −)), la barra di composizione verde/rossa e il numero di + e −. Un valore alto
                indica un fondamentale eseguito con continuità.
              </>,
            ],
            [
              "Dettaglio per giocatore",
              <>
                La tabella elenca, per ogni giocatore, i + e i − di ciascun fondamentale nel formato{" "}
                <b>+ / −</b>: «3 / 1» indica tre valutazioni positive e una negativa. Compaiono solo
                i giocatori con almeno una valutazione nel periodo selezionato.
              </>,
            ],
            [
              "Periodo",
              <>
                «Totale» aggrega l'intera partita; «Set 1», «Set 2»… isolano un singolo set e
                permettono di osservare l'andamento durante la gara.
              </>,
            ],
            [
              "Interpretazione",
              <>
                Il campione è ridotto: con pochi tocchi la percentuale è poco significativa (un solo
                + su un solo tocco vale 100%). I dati riflettono il giudizio dello scout in servizio
                e vanno letti come indicazione di squadra, non come voto individuale.
              </>,
            ],
            [
              "Partite precedenti",
              <>
                Per le partite scoutate con il metodo precedente è mostrato anche il riepilogo delle
                azioni registrate (punti, ace, muri, errori).
              </>,
            ],
          ].map(([titolo, testo]) => (
            <div key={titolo as string}>
              <dt className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
                {titolo}
              </dt>
              <dd className="mt-0.5">{testo}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {scout.valutazioni.length > 0 ? (
        <>
          {sets.length > 1 ? (
            <div
              role="tablist"
              aria-label="Periodo"
              className="mt-3 grid grid-flow-col auto-cols-fr gap-0.5 rounded-2xl bg-secondary p-1"
            >
              {[undefined, ...sets].map((s) => (
                <button
                  key={s ?? "tutta"}
                  type="button"
                  role="tab"
                  aria-selected={s === set}
                  onClick={() => setSet(s)}
                  className={cn(
                    "min-w-0 truncate rounded-xl px-0 py-2 text-[13px] font-bold uppercase transition-colors",
                    s === set
                      ? "bg-primary text-primary-foreground shadow-card"
                      : "text-muted-foreground",
                  )}
                >
                  {s === undefined ? "Totale" : `Set ${s}`}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
            {fondamentali.map((f) => {
              const { piu, meno } = squadra[f.id];
              const p = pct(piu, meno);
              return (
                <div key={f.id} className="rounded-2xl bg-secondary p-3">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
                      {f.label}
                    </p>
                    <p className="font-display text-xl leading-none">
                      {p === null ? "—" : `${p}%`}
                    </p>
                  </div>
                  <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-border">
                    <span className="bg-success" style={{ width: `${p ?? 0}%` }} />
                    <span
                      className="bg-destructive"
                      style={{ width: p === null ? 0 : `${100 - p}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[13px] font-semibold tabular-nums">
                    <span className="text-success">+{piu}</span>
                    <span className="mx-1.5 text-muted-foreground">·</span>
                    <span className="text-destructive">−{meno}</span>
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
            Dettaglio giocatori
          </p>
          {righe.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Nessuna valutazione in questo set.
            </p>
          ) : (
            <div className="mt-2 overflow-hidden rounded-2xl bg-secondary/60">
              <table className="w-full table-fixed text-[13px]">
                <thead>
                  <tr className="text-left text-[13px] uppercase text-muted-foreground">
                    <th className="whitespace-nowrap px-2 py-2 font-bold">Giocatore</th>
                    {fondamentali.map((f) => (
                      <th key={f.id} className="w-11 px-0 py-2 text-center font-bold">
                        {f.label.slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {righe.map(({ g, conteggi }) => (
                    <tr key={g.id}>
                      <td className="px-2 py-2 font-semibold leading-tight [overflow-wrap:normal]">
                        <span className="mr-1.5 tabular-nums text-muted-foreground">
                          #{g.numero}
                        </span>
                        {g.nome}
                      </td>
                      {fondamentali.map((f) => (
                        <td key={f.id} className="px-0 py-2 text-center font-semibold tabular-nums">
                          <span className="text-success">{conteggi[f.id].piu}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-destructive">{conteggi[f.id].meno}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[13px] text-muted-foreground">
            Valutazioni: <span className="text-success">+</span> positive /{" "}
            <span className="text-destructive">−</span> negative. La percentuale è la quota di +.
          </p>
        </>
      ) : null}

      {scout.azioni.length > 0 ? (
        <>
          <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
            Azioni registrate
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center">
            {[
              { l: "Punti", v: totaliAzioni.punti },
              { l: "Ace", v: totaliAzioni.ace },
              { l: "Muri", v: totaliAzioni.muri },
              { l: "Errori", v: totaliAzioni.errori },
            ].map((t) => (
              <div key={t.l} className="rounded-2xl bg-secondary px-1 py-2.5">
                <p className="font-display text-xl leading-none">{t.v}</p>
                <p className="mt-1 text-[13px] font-semibold uppercase text-muted-foreground">
                  {t.l}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            {[...azioni.entries()].map(([gid, t]) => {
              const g = rosa.find((x) => x.id === gid);
              if (!g) return null;
              return (
                <div
                  key={gid}
                  className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-[13px]"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    #{g.numero} {g.nome}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {t.punti}P · {t.ace}A · {t.muri}M · {t.errori}E
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {scout.valutazioni.length === 0 && scout.azioni.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Nessun dato registrato per questa partita.
        </p>
      ) : null}

      {admin ? (
        <button
          type="button"
          onClick={() =>
            scaricaCsv(`scout-${scout.data}-${scout.avversario}.csv`, csvScoutMatch(scout, rosa))
          }
          className="premi mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-grad py-3 text-[15px] font-bold uppercase text-accent-foreground shadow-pop"
        >
          <Download className="h-4 w-4" /> Esporta CSV
        </button>
      ) : null}
    </Card>
  );
}

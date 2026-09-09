import { useState } from "react";
import { ExternalLink, ShieldAlert, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/crapp/ui-bits";
import { useCsiPartita } from "@/lib/csi-partita";
import type { FormazioneSquadra, PrecedentiCsi } from "@/lib/csi-core";

/** Logo squadra dal portale CSI: nascosto invece che rotto se l'immagine non carica. */
export function LogoSquadra({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [errore, setErrore] = useState(false);
  if (!src || errore) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErrore(true)}
      className={cn("shrink-0 rounded-lg object-contain", className)}
    />
  );
}

/** Metadati leggeri sempre disponibili (nessuna fetch aggiuntiva): girone, n° gara, arbitro, referto. */
export function MetaPartitaCsi({
  girone,
  numeroGara,
  arbitro,
  link,
}: {
  girone: string;
  numeroGara: string;
  arbitro: string;
  link: string;
}) {
  const voci = [
    girone,
    numeroGara ? `N° gara ${numeroGara}` : "",
    arbitro ? `Arbitro: ${arbitro}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  if (!voci && !link) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {voci ? <span>{voci}</span> : null}
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-accent"
        >
          Referto ufficiale CSI <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

function ListaFormazione({ squadra }: { squadra: FormazioneSquadra }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {squadra.squadra}
      </p>
      <div className="mt-2 space-y-1">
        {squadra.titolari.map((g, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-6 shrink-0 text-center font-display text-xs text-accent">
              {g.numero}
            </span>
            <span className="min-w-0 flex-1 truncate">{g.nome}</span>
            {g.ruolo ? <span className="text-xs text-muted-foreground">{g.ruolo}</span> : null}
          </div>
        ))}
      </div>
      {squadra.panchina.length > 0 ? (
        <>
          <p className="mt-3 text-[11px] font-bold uppercase text-muted-foreground/70">
            A disposizione
          </p>
          <div className="mt-1 space-y-1">
            {squadra.panchina.map((g, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-6 shrink-0 text-center">{g.numero}</span>
                <span className="min-w-0 flex-1 truncate">{g.nome}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {squadra.staff.length > 0 ? (
        <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
          {squadra.staff.map((s, i) => (
            <div key={i}>
              {s.nome} · {s.ruolo}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BarraPrecedenti({
  label,
  noi,
  avversario,
}: {
  label: string;
  noi: number;
  avversario: number;
}) {
  const totale = noi + avversario || 1;
  return (
    <div className="text-xs">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="font-bold text-foreground">{noi}</span>
        <span>{label}</span>
        <span className="font-bold text-foreground">{avversario}</span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="bg-accent" style={{ width: `${(noi / totale) * 100}%` }} />
      </div>
    </div>
  );
}

const NOME_NOI = "CRAP Volley";

/** Intestazione con i nomi delle due squadre, per non dover ripeterli su ogni barra sotto. */
function TestataSquadre({ avversario }: { avversario: string }) {
  return (
    <div className="flex items-center justify-between text-xs font-bold">
      <span className="truncate text-accent">{NOME_NOI}</span>
      <span className="truncate text-right text-muted-foreground">{avversario}</span>
    </div>
  );
}

function BarraProbabilita({
  avversario,
  noi,
  avversarioPct,
}: {
  avversario: string;
  noi: number;
  avversarioPct: number;
}) {
  const favoritaNoi = noi >= avversarioPct;
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        Probabilità di vittoria (calcolo CSI):{" "}
        <span className="font-bold text-foreground">{favoritaNoi ? NOME_NOI : avversario}</span>{" "}
        favorita al {Math.max(noi, avversarioPct).toFixed(0)}%.
      </p>
      <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
        <span className={favoritaNoi ? "text-success" : "text-muted-foreground"}>{NOME_NOI}</span>
        <span className={!favoritaNoi ? "text-success" : "text-muted-foreground"}>
          {avversario}
        </span>
      </div>
      <div className="flex h-7 overflow-hidden rounded-full">
        <div
          className="flex items-center justify-center bg-success text-xs font-bold text-success-foreground"
          style={{ width: `${noi}%` }}
        >
          {noi.toFixed(0)}%
        </div>
        <div
          className="flex items-center justify-center bg-destructive text-xs font-bold text-destructive-foreground"
          style={{ width: `${avversarioPct}%` }}
        >
          {avversarioPct.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

function BloccoPrecedenti({
  precedenti,
  avversario,
}: {
  precedenti: PrecedentiCsi;
  avversario: string;
}) {
  return (
    <div className="space-y-3">
      <TestataSquadre avversario={avversario} />
      <p className="text-xs text-muted-foreground">
        {precedenti.totale > 0
          ? `${precedenti.totale} precedenti in archivio sul portale CSI.`
          : "Nessun precedente in archivio sul portale CSI: primo confronto tra le due squadre."}
      </p>
      {precedenti.totale > 0 ? (
        <>
          <BarraPrecedenti
            label="vittorie"
            noi={precedenti.vinteNoi}
            avversario={precedenti.vinteAvversario}
          />
          <BarraPrecedenti
            label="in casa"
            noi={precedenti.casaNoi}
            avversario={precedenti.casaAvversario}
          />
          <BarraPrecedenti
            label="fuori"
            noi={precedenti.fuoriNoi}
            avversario={precedenti.fuoriAvversario}
          />
        </>
      ) : null}
      {precedenti.probabilitaNoi !== null && precedenti.probabilitaAvversario !== null ? (
        <BarraProbabilita
          avversario={avversario}
          noi={precedenti.probabilitaNoi}
          avversarioPct={precedenti.probabilitaAvversario}
        />
      ) : null}
    </div>
  );
}

/**
 * Formazioni e storico scontri diretti per una gara CSI: una fetch in più (cache 6h lato
 * server), quindi va montato solo quando l'utente apre il dettaglio della gara, mai in una
 * lista. `matchId` è l'id della gara sul portale CSI (`PartitaCsi.id`). `avversario` serve
 * solo a etichettare le barre di "Scontri diretti" (nome squadra, non un dato dal CSI).
 */
export function DettaglioCsiEsteso({
  matchId,
  avversario,
}: {
  matchId: string;
  avversario: string;
}) {
  const { data, isLoading } = useCsiPartita(matchId);

  if (isLoading) {
    return <p className="px-1 text-center text-xs text-muted-foreground">Carico i dati dal CSI…</p>;
  }
  if (!data || (!data.formazioni && !data.precedenti)) return null;

  return (
    <div className="space-y-4">
      {data.giornata || data.nota ? (
        <p className="text-xs text-muted-foreground">
          {[data.giornata, data.nota].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {data.formazioni ? (
        <Card>
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Users2 className="h-4 w-4 text-accent" /> Formazioni
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ListaFormazione squadra={data.formazioni.noi} />
            <ListaFormazione squadra={data.formazioni.avversario} />
          </div>
        </Card>
      ) : null}
      {data.precedenti ? (
        <Card>
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <ShieldAlert className="h-4 w-4 text-accent" /> Scontri diretti
          </div>
          <BloccoPrecedenti precedenti={data.precedenti} avversario={avversario} />
        </Card>
      ) : null}
    </div>
  );
}

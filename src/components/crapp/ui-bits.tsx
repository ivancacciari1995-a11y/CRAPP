import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inizialiDa, statoMeta, type Stato } from "@/lib/crapp-data";
import { nomeCompleto } from "@/lib/giocatori-squadra";
import { useGiocatoreBase } from "@/lib/user-store";
import { useMotoRidotto } from "@/lib/motion";
import { molla, proietta } from "@/lib/molla";
import {
  pallinoNotifiche,
  useEliminaNotifica,
  useNotificheMie,
  useSegnaLette,
  type NotificaUtente,
} from "@/lib/notifiche-utente";
import { Avatar } from "@/components/crapp/Avatar";
import { Reveal } from "@/components/motion/Reveal";
import { Numero } from "@/components/motion/Numero";

export function TeamLogo({
  className,
  /**
   * Di default l'icona della PWA, che ha dentro il nome dell'app. Dove serve lo
   * stemma della squadra e basta si passa `/logo-nerorosso.svg`.
   */
  src = "/icon-192.png",
}: {
  className?: string;
  src?: string;
}) {
  return (
    <img
      src={src}
      alt="CRAP Volley"
      width={192}
      height={192}
      decoding="async"
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

/** "or ora" / "tra 3 ore" / "2 giorni fa" — così basta guardare senza fare i conti. */
function tempoRelativo(dataIso: string): string {
  const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
  const minuti = Math.round((new Date(dataIso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minuti) < 60) return rtf.format(minuti, "minute");
  const ore = Math.round(minuti / 60);
  if (Math.abs(ore) < 24) return rtf.format(ore, "hour");
  return rtf.format(Math.round(ore / 24), "day");
}

/**
 * Una riga del pannello notifiche, eliminabile con uno swipe a sinistra o con la ×: non
 * c'è pulizia automatica delle notifiche vecchie (M17), quindi è l'unico modo per un
 * giocatore di togliersele di torno. Soglia e proiezione della velocità di rilascio come
 * lo swipe del calendario (`src/routes/calendario.tsx`), ma qui in una sola direzione: non
 * c'è "indietro", solo "via".
 */
function RigaNotifica({
  notifica,
  onElimina,
}: {
  notifica: NotificaUtente;
  onElimina: (id: string) => void;
}) {
  const ridotto = useMotoRidotto();
  return (
    <motion.li
      layout={!ridotto}
      initial={false}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={molla.ui}
      className="relative overflow-hidden rounded-xl"
    >
      <motion.div
        drag={ridotto ? false : "x"}
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={{ left: 0.2, right: 0 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          const arrivo = info.offset.x + proietta(info.velocity.x);
          if (arrivo < -60) onElimina(notifica.id);
        }}
        className="touch-pan-y bg-card p-3 pr-8 text-sm"
      >
        <p className="font-semibold">{notifica.titolo}</p>
        {notifica.corpo ? <p className="mt-0.5 text-muted-foreground">{notifica.corpo}</p> : null}
        <p className="mt-1 text-xs text-muted-foreground">{tempoRelativo(notifica.creataIl)}</p>
      </motion.div>
      <button
        type="button"
        onClick={() => onElimina(notifica.id)}
        aria-label="Rimuovi notifica"
        className="absolute right-1 top-1 rounded-full p-1.5 text-muted-foreground active:scale-90"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
}

/**
 * Accesso al profilo in alto a destra: la BottomNav ha quattro voci e questa è
 * l'unica porta verso `/profilo`. Sulla pagina del profilo si passa `azione` a
 * `PageHeader` con il logo che porta alla home.
 *
 * Usa `useGiocatoreBase` (sola anagrafica) e non `useIo`: qui serve solo id e
 * iniziali, mentre `useIo` calcola l'intera rosa con statistiche (MVP, pagelle,
 * cacche, palloni, infortuni). Essendo in un componente montato su quasi ogni
 * pagina, quei moduli finirebbero nel bundle condiviso di tutte le rotte.
 *
 * Sopra l'avatar sta il pallino del centro notifiche (M17): il tap sull'avatar
 * porta sempre al profilo, quello sul pallino apre il pannello.
 */
export function LinkProfilo() {
  const g = useGiocatoreBase();
  if (!g) return <TeamLogo className="h-12 w-12" />;
  return (
    <div className="relative shrink-0">
      <Link
        to="/profilo"
        aria-label="Il tuo profilo"
        className="premi block rounded-2xl ring-2 ring-primary-foreground/30"
      >
        <Avatar id={g.id} fallback={inizialiDa(nomeCompleto(g))} className="h-12 w-12 text-lg" />
      </Link>
      <PallinoNotifiche />
    </div>
  );
}

/**
 * Pallino del centro notifiche (M17) sull'angolo dell'avatar (aspetto deciso da
 * `pallinoNotifiche()`). Copre quattro sorgenti generate lato database (mai dal client):
 * messaggi admin, promemoria automatici, turno palloni, sollecito presenze — vedi
 * `src/lib/notifiche-utente.ts`.
 *
 * Nel progetto non c'è una libreria dropdown: il pannello è un `div` posizionato a mano,
 * chiuso al click fuori o con Escape. Aprirlo segna tutte le notifiche come lette; per
 * toglierle di mezzo per sempre serve lo swipe o la × di `RigaNotifica`.
 */
function PallinoNotifiche() {
  const { notifiche, nonLette } = useNotificheMie();
  const segnaLette = useSegnaLette();
  const eliminaNotifica = useEliminaNotifica();
  const [aperto, setAperto] = useState(false);
  const riquadro = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aperto) return;
    const chiudiSeFuori = (e: MouseEvent) => {
      if (riquadro.current && !riquadro.current.contains(e.target as Node)) setAperto(false);
    };
    const chiudiConEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAperto(false);
    };
    document.addEventListener("mousedown", chiudiSeFuori);
    document.addEventListener("keydown", chiudiConEsc);
    return () => {
      document.removeEventListener("mousedown", chiudiSeFuori);
      document.removeEventListener("keydown", chiudiConEsc);
    };
  }, [aperto]);

  const pallino = pallinoNotifiche(notifiche.length, nonLette);
  if (!pallino) return null;

  function alClick() {
    const stavaChiuso = !aperto;
    setAperto(stavaChiuso);
    if (stavaChiuso && nonLette > 0) segnaLette.mutate();
  }

  // Tolta l'ultima, il pallino sparisce: chiuso anche il pannello, così alla prossima
  // notifica non si riapre da solo.
  function elimina(id: string) {
    if (notifiche.length === 1) setAperto(false);
    eliminaNotifica.mutate(id);
  }

  return (
    <div ref={riquadro}>
      {/* `after:` allarga l'area di tocco oltre i 20px del pallino senza ingrandirlo. */}
      <button
        type="button"
        onClick={alClick}
        aria-label={nonLette > 0 ? `Notifiche, ${nonLette} da leggere` : "Notifiche"}
        aria-expanded={aperto}
        className={cn(
          "absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold shadow-pop ring-2 ring-primary-foreground after:absolute after:-inset-3 active:scale-90",
          pallino.daLeggere
            ? "bg-accent-grad text-accent-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {pallino.testo}
      </button>
      {aperto ? (
        <div className="absolute right-0 top-14 z-50 w-72 max-w-[calc(100vw-2.5rem)] rounded-2xl bg-card p-2 text-foreground shadow-card">
          <ul className="max-h-80 overflow-y-auto">
            <AnimatePresence initial={false}>
              {notifiche.map((n) => (
                <RigaNotifica key={n.id} notifica={n} onElimina={elimina} />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      ) : null}
    </div>
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
  titolo?: string;
  azione?: ReactNode;
  children: ReactNode;
  indice?: number;
}) {
  return (
    <Reveal as="section" indice={indice} className="px-5 py-4">
      {titolo || azione ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          {titolo ? <h2 className="font-display-sm text-[20px] uppercase">{titolo}</h2> : <span />}
          {azione}
        </div>
      ) : null}
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

/**
 * Classi condivise di input, select e textarea nei form dell'app. `h-10`:
 * `input[type="date"]` ha al suo interno segmenti e icona nativi che, anche
 * con `appearance-none`, restano un filo più alti di un input di testo a
 * parità di padding — un'altezza esplicita allinea tutti i campi tra loro.
 */
export const classiInput =
  "h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm";

/**
 * Etichetta + controllo di un form. `min-w-0`: dentro `grid-cols-2` questa label
 * è l'elemento di griglia e ha `min-width: auto`, quindi si allarga fino al
 * contenuto invece di stare nella colonna. Con un controllo nativo largo dentro
 * (una data o un'ora su iOS) la coppia sfonda la card.
 */
export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

/**
 * `<select>` nativo con la stessa altezza degli altri campi del form. Il
 * controllo nativo di un `<select>` ignora parzialmente il padding di
 * `classiInput` (soprattutto su Android), risultando più alto o più basso
 * degli input accanto: `appearance-none` lo riporta a una scatola CSS
 * normale, la freccia va poi ridisegnata a mano perché sparisce con lui.
 */
export function Select(props: ComponentPropsWithoutRef<"select">) {
  return (
    <span className="relative block">
      <select {...props} className={cn(classiInput, "appearance-none pr-8", props.className)} />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </span>
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

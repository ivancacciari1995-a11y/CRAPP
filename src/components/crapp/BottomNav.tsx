import { Link } from "@tanstack/react-router";
import { CalendarDays, Home, Trophy, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { molla } from "@/lib/molla";

// Quattro voci e non cinque: il profilo sta in alto a destra
// nell'intestazione di ogni pagina, dove lo cerca chi arriva da iOS.
const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/calendario", label: "Calendario", icon: CalendarDays },
  { to: "/squadra", label: "Squadra", icon: Users },
  { to: "/classifica", label: "Classifica", icon: Trophy },
] as const;

export function BottomNav() {
  const ridotto = useReducedMotion();

  return (
    <nav
      aria-label="Navigazione principale"
      // Barra flottante: il contenitore esterno tiene solo la posizione e
      // l'inset di sistema, il materiale sta sulla pillola dentro.
      // `pointer-events-none` perché ai lati della pillola i tocchi devono
      // arrivare al contenuto sotto.
      className="pad-sicura-fondo pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3"
    >
      {/*
        La mappa di spostamento del vetro. `feTurbulence` a bassa frequenza dà
        una deformazione lenta e irregolare — la stessa cosa che fa un vetro non
        perfettamente piano — e la sfocatura che segue toglie il granuloso del
        rumore, altrimenti il fondale si sgranerebbe invece di piegarsi.

        Nessuna dimensione e nessun colore: è solo la definizione del filtro che
        il CSS richiama per id. La usa solo Blink (vedi `@supports` in
        styles.css); su WebKit questo SVG resta lì senza fare niente.
      */}
      <svg aria-hidden="true" className="absolute h-0 w-0" focusable="false">
        <filter id="vetro-rifrazione" colorInterpolationFilters="sRGB">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.016"
            numOctaves={2}
            seed={7}
            result="rumore"
          />
          <feGaussianBlur in="rumore" stdDeviation={3} result="mappa" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="mappa"
            scale={16}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      {/*
        Altezza fissa dal token, non dedotta dal contenuto: la striscia
        toccabile misura uguale su iOS e Android, e sotto varia solo l'inset
        di sistema. Prima l'altezza dipendeva dai padding delle voci e nessuno
        poteva saperla da fuori.
      */}
      {/* `vetro` porta con sé le proprie ombre, quindi niente `shadow-chrome`:
          sarebbero due `box-shadow` sullo stesso elemento e una vincerebbe. */}
      <div className="vetro pointer-events-auto mx-auto grid h-[var(--altezza-nav)] max-w-md grid-cols-4 rounded-full border border-white/40 p-1.5">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            activeProps={{ "aria-current": "page" }}
            // Lo stato attivo non è solo colore: è la capsula piena sotto la
            // voce, più il peso del testo. Chi non distingue i colori vede
            // comunque quale voce è quella corrente.
            className="group relative flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-xs font-semibold text-muted-foreground transition-colors data-[status=active]:font-extrabold data-[status=active]:text-accent-foreground"
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <motion.span
                    // `layoutId`: la capsula è un solo elemento che scivola da
                    // una voce all'altra invece di sparire e ricomparire. La
                    // molla è interrompibile, quindi due tocchi rapidi non
                    // fanno saltare la posizione.
                    layoutId="capsula-nav"
                    aria-hidden="true"
                    className="bg-accent-grad absolute inset-0 rounded-full shadow-pop"
                    transition={ridotto ? { duration: 0 } : molla.ui}
                  />
                ) : null}
                {/* Sopra la capsula, che è in flusso normale sotto di loro. */}
                <span className="relative flex flex-col items-center gap-0.5">
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.6 : 2.2} />
                  {label}
                </span>
              </>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}

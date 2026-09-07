import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { proietta } from "@/lib/molla";

export type VoceSottosezione = {
  id: string;
  label: string;
  contenuto: ReactNode;
  /** Se true, il pannello è a tutta larghezza (niente padding), es. barra filtri Classifica. */
  aTuttoLarghezza?: boolean;
};

/** Tween breve: evita molle + exit che tengono due pannelli in DOM insieme. */
const transizioneTab = { type: "tween" as const, duration: 0.16, ease: [0.25, 0.1, 0.25, 1] };

/**
 * Barra di sottosezioni in un'unica fila e pannello che mostra una sola sezione
 * alla volta, cambiabile anche con swipe sul contenuto.
 *
 * `variante="sottolineatura"`: pillola piena sulla tab attiva (Squadra e Classifica CSI);
 * su mobile la sola barra tab scorre in orizzontale senza allargare la pagina.
 * Default `pillole`: tab a larghezza naturale (Profilo). Il titolo ripetuto sotto la
 * barra non viene mai mostrato: l’etichetta è già nella tab.
 */
export function BarraSottosezioni({
  voci,
  defaultId,
  variante = "pillole",
  riempiLarghezza = false,
}: {
  voci: VoceSottosezione[];
  defaultId?: string;
  variante?: "pillole" | "sottolineatura";
  /** Tab a larghezza uguale che riempiono la barra (es. Campionato). */
  riempiLarghezza?: boolean;
}) {
  const [attiva, setAttiva] = useState(defaultId ?? voci[0]?.id ?? "");
  const direzione = useRef(0);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const ridotto = useReducedMotion();
  const indice = Math.max(
    0,
    voci.findIndex((v) => v.id === attiva),
  );
  const voce = voci[indice] ?? voci[0];
  const sottolineatura = variante === "sottolineatura";

  useEffect(() => {
    tabRefs.current[attiva]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [attiva]);

  function vaiA(nuovo: number) {
    if (nuovo < 0 || nuovo >= voci.length) return;
    const target = voci[nuovo];
    if (!target || target.id === attiva) return;
    direzione.current = nuovo > indice ? 1 : -1;
    setAttiva(target.id);
  }

  if (!voce) return null;

  return (
    <div className="min-w-0 max-w-full">
      <div
        className={cn(
          "min-w-0 max-w-full border-b border-border bg-background",
          !sottolineatura && "bg-background/80 pt-3 backdrop-blur-md",
        )}
      >
        {/* Solo la barra tab può scrollare in orizzontale: non allarga il layout pagina. */}
        <div
          className={cn(
            "w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            !sottolineatura && "pb-3",
          )}
        >
          <div
            role="tablist"
            aria-label="Sottosezioni"
            className={cn(
              "flex flex-nowrap",
              riempiLarghezza
                ? "w-full"
                : "w-max min-w-full",
              sottolineatura ? "gap-1 px-2 py-1.5" : "snap-x snap-mandatory gap-1.5 px-5",
            )}
          >
            {voci.map((v) => {
              const selezionata = v.id === attiva;
              return (
                <button
                  key={v.id}
                  ref={(el) => {
                    tabRefs.current[v.id] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={selezionata}
                  onClick={() => {
                    const i = voci.findIndex((x) => x.id === v.id);
                    vaiA(i);
                  }}
                  className={cn(
                    "min-h-11 touch-manipulation whitespace-nowrap text-sm font-bold uppercase tracking-wide transition-colors",
                    riempiLarghezza ? "min-w-0 flex-1" : "shrink-0",
                    sottolineatura
                      ? cn(
                          "rounded-xl px-1 py-2.5 text-center",
                          selezionata
                            ? "bg-accent text-accent-foreground shadow-pop"
                            : "text-muted-foreground",
                        )
                      : cn(
                          "snap-center rounded-full px-3.5 py-2",
                          selezionata
                            ? "bg-accent text-accent-foreground shadow-pop"
                            : "bg-secondary text-muted-foreground",
                        ),
                  )}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative min-w-0 overflow-hidden">
        <motion.div
          key={voce.id}
          role="tabpanel"
          aria-label={voce.label}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            const arrivo = info.offset.x + proietta(info.velocity.x);
            if (arrivo < -60) vaiA(indice + 1);
            else if (arrivo > 60) vaiA(indice - 1);
          }}
          initial={ridotto ? { opacity: 0 } : { opacity: 0, x: direzione.current * 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={ridotto ? { duration: 0.1 } : transizioneTab}
          className={cn("touch-pan-y", voce.aTuttoLarghezza ? "px-0 pt-0 pb-4" : "px-5 py-4")}
        >
          {voce.contenuto}
        </motion.div>
      </div>
    </div>
  );
}

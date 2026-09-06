import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { proietta } from "@/lib/molla";

export type VoceSottosezione = {
  id: string;
  label: string;
  contenuto: ReactNode;
  /** Se true, non ripete il titolo della tab sopra il contenuto (es. Classifica già nella barra). */
  nascondiTitolo?: boolean;
};

/** Tween breve: evita molle + exit che tengono due pannelli in DOM insieme. */
const transizioneTab = { type: "tween" as const, duration: 0.16, ease: [0.25, 0.1, 0.25, 1] };

/**
 * Barra di sottosezioni in un'unica fila scorrevole (swipe orizzontale) e
 * pannello che mostra una sola sezione alla volta, cambiabile anche con
 * swipe sul contenuto.
 *
 * `variante="sottolineatura"`: tab a testo con sottolineatura rossa e senza titolo
 * ripetuto sotto la barra (Squadra e Classifica CSI). Default `pillole`: restano le
 * pill e i titoli usati dal Profilo.
 */
export function BarraSottosezioni({
  voci,
  defaultId,
  variante = "pillole",
}: {
  voci: VoceSottosezione[];
  defaultId?: string;
  variante?: "pillole" | "sottolineatura";
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
    // `auto`: lo smooth competerebbe col tween del pannello sul main thread.
    tabRefs.current[attiva]?.scrollIntoView({
      behavior: "auto",
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
    <div>
      <div
        className={cn(
          "border-b border-border bg-background",
          !sottolineatura && "bg-background/80 pt-3 backdrop-blur-md",
        )}
      >
        <div
          role="tablist"
          aria-label="Sottosezioni"
          className={cn(
            "flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            sottolineatura ? "gap-0 px-2" : "-mx-0 gap-1.5 px-5 pb-3",
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
                  "snap-center shrink-0 grow basis-0 touch-manipulation whitespace-nowrap text-xs font-bold uppercase tracking-wide transition-colors",
                  "min-h-11",
                  sottolineatura
                    ? cn(
                        "rounded-none border-b-2 px-3 py-3",
                        selezionata
                          ? "border-accent text-foreground"
                          : "border-transparent text-muted-foreground",
                      )
                    : cn(
                        "rounded-full px-3.5 py-2",
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

      <div className="relative overflow-hidden">
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
          className={cn("touch-pan-y", voce.nascondiTitolo ? "px-0 pt-0 pb-4" : "px-5 py-4")}
        >
          {voce.nascondiTitolo || sottolineatura ? null : (
            <h2 className="mb-3 font-display-sm text-lg uppercase">{voce.label}</h2>
          )}
          {voce.contenuto}
        </motion.div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Check, CircleDot, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crapp/Avatar";
import { nomeCompleto, useGiocatoriSquadra } from "@/lib/giocatori-squadra";
import { useAssegnaTurno, useTurniPalloni } from "@/lib/palloni";
import { useGiocatoreCorrente } from "@/lib/user-store";

export function TurnoPalloni({ eventoId }: { eventoId: string }) {
  const [aperto, setAperto] = useState(false);
  const { salvati, turni, isPending } = useTurniPalloni();
  const assegna = useAssegnaTurno();
  const io = useGiocatoreCorrente();
  const { righe: squadra } = useGiocatoriSquadra();
  const rosa = squadra.filter((g) => g.attivo);

  const id = turni[eventoId];
  const proposto = !salvati[eventoId];
  const giocatore = rosa.find((g) => g.id === id);

  function scegli(giocatoreId: string) {
    setAperto(false);
    assegna.mutate(
      { eventoId, giocatoreId, da: io?.nome ?? null },
      {
        onSuccess: () => toast.success("Turno palloni aggiornato"),
        onError: () => toast.error("Non sono riuscito a salvare il turno"),
      },
    );
  }

  return (
    <div className="mt-3 rounded-2xl bg-secondary/60 p-2.5">
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        className="flex w-full items-center gap-2.5 text-left"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-card text-accent">
          <CircleDot className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Palloni
          </span>
          <span className="flex items-center gap-1.5 text-sm font-bold leading-tight">
            {isPending || assegna.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : null}
            <span className="truncate">{giocatore ? nomeCompleto(giocatore) : "Da assegnare"}</span>
            {proposto && giocatore ? (
              <span className="shrink-0 rounded-full bg-card px-1.5 py-0.5 text-xs font-bold uppercase text-muted-foreground">
                proposto
              </span>
            ) : null}
          </span>
        </span>
        <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {aperto ? (
        <div className="mt-2.5 max-h-56 space-y-1 overflow-y-auto rounded-xl bg-card p-1.5">
          {rosa.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => scegli(g.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                g.id === id ? "bg-accent/10 font-bold" : "hover:bg-secondary",
              )}
            >
              <Avatar id={g.id} fallback={String(g.numero)} className="h-7 w-7 text-xs" />
              <span className="min-w-0 flex-1 truncate">{nomeCompleto(g)}</span>
              {g.id === id ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

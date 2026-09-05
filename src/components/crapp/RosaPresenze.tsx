import { useState } from "react";
import { BellRing, HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card } from "@/components/crapp/ui-bits";
import { Avatar } from "@/components/crapp/Avatar";
import { Barra } from "@/components/motion/Barra";
import { statoMeta, type Giocatore, type Stato } from "@/lib/crapp-data";
import { usePresenzeEvento, useSalvaPresenza } from "@/lib/presenze";
import { useRosa } from "@/lib/rosa";
import { useGiocatoreCorrente } from "@/lib/user-store";
import { useIsAdmin } from "@/lib/ruoli";

const ordine: Stato[] = ["presente", "ritardo", "forse", "infortunato", "assente"];

export function RosaPresenze({ eventoId }: { eventoId: string }) {
  const { risposte, isPending } = usePresenzeEvento(eventoId);
  const salva = useSalvaPresenza();
  const io = useGiocatoreCorrente();
  const admin = useIsAdmin();
  const rosa = useRosa();
  const [sollecito, setSollecito] = useState(false);

  const mancanti = rosa.filter((g) => !risposte[g.id]);
  const risposteN = rosa.length - mancanti.length;
  const perc = rosa.length ? Math.round((risposteN / rosa.length) * 100) : 0;
  const daSollecitare = mancanti.length + rosa.filter((g) => risposte[g.id] === "forse").length;

  async function sollecita() {
    setSollecito(true);
    try {
      const res = await fetch("/api/public/sollecita-presenze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId, da: io?.nome }),
      });
      if (!res.ok) throw new Error();
      const dati = (await res.json()) as { inviate: number; destinatari: number };
      toast.success(
        dati.inviate > 0
          ? `Sollecito inviato a ${dati.inviate} giocatori`
          : `Nessuna notifica attiva tra i ${dati.destinatari} da sollecitare`,
      );
    } catch {
      toast.error("Non sono riuscito a inviare il sollecito");
    } finally {
      setSollecito(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold">
            Hanno risposto {risposteN}/{rosa.length}
          </p>
          <span className="font-display text-xl leading-none">{perc}%</span>
        </div>
        <Barra percentuale={perc} altezza="h-1.5" trackClassName="mt-2" />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {ordine.map((s) => {
            const n = rosa.filter((g) => risposte[g.id] === s).length;
            return (
              <span
                key={s}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-bold",
                  n > 0 ? statoMeta[s].className : "bg-secondary text-muted-foreground",
                )}
              >
                {statoMeta[s].emoji} {n}
              </span>
            );
          })}
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">
            ❔ {mancanti.length} da rispondere
          </span>
        </div>

        {io ? (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              La tua risposta
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ordine.map((s) => {
                const attivo = risposte[io.id] === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={salva.isPending}
                    onClick={() =>
                      salva.mutate({ eventoId, giocatoreId: io.id, stato: attivo ? null : s })
                    }
                    className={cn(
                      "rounded-full border border-border px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-95",
                      attivo
                        ? cn(statoMeta[s].className, "border-transparent shadow-card")
                        : "bg-background text-muted-foreground",
                    )}
                  >
                    {statoMeta[s].label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {admin ? (
          <button
            type="button"
            onClick={sollecita}
            disabled={sollecito || daSollecitare === 0}
            className="premi mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {sollecito ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellRing className="h-4 w-4" />
            )}
            Sollecita {daSollecitare} giocatori
          </button>
        ) : null}
      </Card>

      {isPending ? (
        <p aria-busy="true" className="text-center text-xs text-muted-foreground">
          Carico le risposte…
        </p>
      ) : null}

      {ordine.map((s) => {
        const lista = rosa.filter((g) => risposte[g.id] === s);
        if (lista.length === 0) return null;
        return (
          <Gruppo
            key={s}
            titolo={`${statoMeta[s].emoji} ${statoMeta[s].label}`}
            n={lista.length}
            lista={lista}
          />
        );
      })}

      {mancanti.length > 0 ? (
        <Gruppo
          titolo="❔ Non hanno ancora risposto"
          n={mancanti.length}
          lista={mancanti}
          attenzione
        />
      ) : null}
    </div>
  );
}

function Gruppo({
  titolo,
  n,
  lista,
  attenzione,
}: {
  titolo: string;
  n: number;
  lista: Giocatore[];
  attenzione?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-card p-4 shadow-card",
        attenzione && "border border-dashed border-warning",
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {titolo} · {n}
        {attenzione ? <HelpCircle className="h-3.5 w-3.5 text-warning" /> : null}
      </p>
      <div className="mt-3 space-y-2">
        {lista.map((g) => (
          <div key={g.id} className="flex items-center gap-3">
            <Avatar id={g.id} fallback={String(g.numero)} className="h-8 w-8 text-xs" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.nome}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{g.ruolo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

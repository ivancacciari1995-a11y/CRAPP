import { useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card } from "@/components/crapp/ui-bits";
import { nomeCompleto, useGiocatoriSquadra } from "@/lib/giocatori-squadra";
import { useGiocatoreCorrente } from "@/lib/user-store";
import { intestazioniAutenticate } from "@/lib/auth";
import { useIsAdmin } from "@/lib/ruoli";
import { mediaPartita, sondaggioAperto, useCacche, useSalvaCacche } from "@/lib/cacche";

const opzioni = [0, 1, 2, 3, 4, 5];

/** Sondaggio goliardico pre-partita: quante cacche prima del fischio d'inizio. */
export function SondaggioCacche({
  eventoId,
  dataEvento,
}: {
  eventoId: string;
  dataEvento: string;
}) {
  const io = useGiocatoreCorrente();
  const { righe } = useCacche();
  const salva = useSalvaCacche();
  const { righe: squadra } = useGiocatoriSquadra();
  const admin = useIsAdmin();
  const [avviso, setAvviso] = useState(false);

  const dellaPartita = righe.filter((r) => r.evento_id === eventoId);
  const mia = dellaPartita.find((r) => r.giocatore_id === io?.id);
  const media = mediaPartita(righe, eventoId);
  const classifica = [...dellaPartita]
    .sort((a, b) => b.quantita - a.quantita)
    .slice(0, 3)
    .map((r) => {
      const g = squadra.find((g) => g.id === r.giocatore_id);
      return { ...r, nome: g ? nomeCompleto(g) : "—" };
    });

  async function rispondi(quantita: number) {
    if (!io) return;
    try {
      await salva.mutateAsync({ evento_id: eventoId, giocatore_id: io.id, quantita });
      toast.success("Risposta registrata 💩");
    } catch {
      toast.error("Non sono riuscito a salvare la risposta");
    }
  }

  async function avvisaTutti() {
    setAvviso(true);
    try {
      const res = await fetch("/api/public/apri-sondaggio", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await intestazioniAutenticate()) },
        body: JSON.stringify({ eventoId }),
      });
      if (!res.ok) throw new Error();
      const dati = (await res.json()) as { inviate: number; destinatari: number };
      toast.success(
        dati.inviate > 0
          ? `Notifica inviata a ${dati.inviate} dispositivi`
          : "Nessun dispositivo con le notifiche attive",
      );
    } catch {
      toast.error("Non sono riuscito a inviare la notifica");
    } finally {
      setAvviso(false);
    }
  }

  if (!sondaggioAperto(dataEvento)) {
    return (
      <Card>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          💩 Sondaggio pre-partita
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Apre alle 8:00 del giorno della partita: riceverai una notifica.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          💩 Sondaggio pre-partita
        </p>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold uppercase text-muted-foreground">
          {dellaPartita.length} risposte
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Quante cacche hai fatto prima di questa partita? Dato scientifico fondamentale.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {opzioni.map((n) => (
          <button
            key={n}
            type="button"
            disabled={!io || salva.isPending}
            onClick={() => rispondi(n)}
            className={cn(
              "min-w-11 rounded-xl px-3 py-2 text-sm font-bold tabular-nums transition-transform active:scale-90 disabled:opacity-50",
              mia?.quantita === n
                ? "bg-accent text-accent-foreground shadow-pop"
                : "bg-secondary text-foreground",
            )}
          >
            {n === 5 ? "5+" : n}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">
          Media squadra {media}
        </span>
        {classifica.map((r, i) => (
          <span
            key={r.giocatore_id}
            className="rounded-full bg-secondary px-2.5 py-1 font-semibold"
          >
            {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {r.nome} · {r.quantita}
          </span>
        ))}
      </div>

      {admin ? (
        <button
          type="button"
          onClick={avvisaTutti}
          disabled={avviso}
          className="premi mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {avviso ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          Avvisa tutti del sondaggio
        </button>
      ) : null}
    </Card>
  );
}

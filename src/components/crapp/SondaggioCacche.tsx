import { useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card } from "@/components/crapp/ui-bits";
import { nomeCompleto, useGiocatoriSquadra } from "@/lib/giocatori-squadra";
import { useGiocatoreInCampo } from "@/lib/user-store";
import { intestazioniAutenticate } from "@/lib/auth";
import { useIsAdmin } from "@/lib/ruoli";
import {
  mediaPartita,
  sondaggioAperto,
  sondaggioTerminato,
  useCacche,
  useSalvaCacche,
} from "@/lib/cacche";

const opzioni = [0, 1, 2, 3, 4, 5];

/** Sondaggio goliardico pre-partita: quante cacche prima del fischio d'inizio. */
export function SondaggioCacche({
  eventoId,
  dataEvento,
  oraEvento,
}: {
  eventoId: string;
  dataEvento: string;
  oraEvento: string;
}) {
  // Solo `.id` serve qui, niente statistiche; `null` per l'allenatore, che non gioca (DD-034).
  const io = useGiocatoreInCampo();
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
    .map((r) => {
      const g = squadra.find((g) => g.id === r.giocatore_id);
      return { ...r, nome: g ? nomeCompleto(g) : "—" };
    })
    // Pari merito = stessa posizione, senza salti (1°, 1°, 2°).
    .map((r, _, tutti) => ({
      ...r,
      pos: new Set(tutti.filter((t) => t.quantita > r.quantita).map((t) => t.quantita)).size + 1,
    }));

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
          : "Avviso inviato in app e per email (nessun dispositivo con le notifiche attive)",
      );
    } catch {
      toast.error("Non sono riuscito a inviare la notifica");
    } finally {
      setAvviso(false);
    }
  }

  if (!sondaggioAperto(dataEvento, oraEvento)) {
    return (
      <Card>
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
          💩 Sondaggio pre-partita
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {sondaggioTerminato(dataEvento, oraEvento)
            ? "Sondaggio chiuso: era aperto fino al fischio d'inizio."
            : "Apre alle 8:00 del giorno della partita: riceverai una notifica."}
        </p>
        <Classifica righe={classifica} io={io?.id} media={media} />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
          💩 Sondaggio pre-partita
        </p>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[13px] font-bold uppercase text-muted-foreground">
          {dellaPartita.length} risposte
        </span>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">
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
              "min-w-11 rounded-xl px-3 py-2 text-[15px] font-bold tabular-nums transition-transform active:scale-90 disabled:opacity-50",
              mia?.quantita === n
                ? "bg-accent text-accent-foreground shadow-pop"
                : "bg-secondary text-foreground",
            )}
          >
            {n === 5 ? "5+" : n}
          </button>
        ))}
      </div>

      <Classifica righe={classifica} io={io?.id} media={media} />

      {admin ? (
        <button
          type="button"
          onClick={avvisaTutti}
          disabled={avviso}
          className="premi mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-[15px] font-bold text-primary-foreground disabled:opacity-50"
        >
          {avviso ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          Avvisa tutti del sondaggio
        </button>
      ) : null}
    </Card>
  );
}

const MEDAGLIE = ["🥇", "🥈", "🥉"];

type RigaClassifica = { giocatore_id: string; nome: string; quantita: number; pos: number };

function Classifica({
  righe,
  io,
  media,
}: {
  righe: RigaClassifica[];
  io: string | undefined;
  media: number | string;
}) {
  if (righe.length === 0) return null;
  const max = Math.max(...righe.map((r) => r.quantita), 1);
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <span className="font-bold uppercase tracking-wide text-muted-foreground">Classifica</span>
        <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">
          Media squadra {media}
        </span>
      </div>
      <ol className="divide-y divide-border overflow-hidden rounded-2xl bg-secondary/60">
        {righe.map((r) => (
          <li
            key={r.giocatore_id}
            className={cn(
              "relative flex items-center gap-3 px-3 py-2.5",
              r.giocatore_id === io && "bg-accent/15",
            )}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-accent/10"
              style={{ width: `${(r.quantita / max) * 100}%` }}
            />
            <span className="relative w-7 text-center text-[15px] font-bold tabular-nums text-muted-foreground">
              {r.pos <= 3 ? MEDAGLIE[r.pos - 1] : `${r.pos}°`}
            </span>
            <span className="relative min-w-0 flex-1 truncate text-[15px] font-semibold">
              {r.nome}
              {r.giocatore_id === io ? (
                <span className="ml-1.5 text-[13px] font-bold uppercase text-muted-foreground">
                  tu
                </span>
              ) : null}
            </span>
            <span className="relative text-[17px] font-bold tabular-nums">
              {r.quantita === 5 ? "5+" : r.quantita}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

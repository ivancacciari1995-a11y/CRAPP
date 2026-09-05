import { useState } from "react";
import { ClipboardCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card } from "@/components/crapp/ui-bits";
import { Avatar } from "@/components/crapp/Avatar";
import type { Giocatore } from "@/lib/crapp-data";
import { useGiocatoreCorrente } from "@/lib/user-store";
import { mieiVoti, pagellePartita, usePagelle, useVotaPagella } from "@/lib/pagelle";

const voti = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Pagelle di fine partita: voto anonimo 1-10 a ciascun compagno. */
export function Pagelle({
  matchId,
  convocati,
  chiuse = false,
}: {
  matchId: string;
  convocati: Giocatore[];
  chiuse?: boolean;
}) {
  const io = useGiocatoreCorrente();
  const { voti: tutti, isPending } = usePagelle();
  const vota = useVotaPagella();
  const [apertoPer, setApertoPer] = useState<string | null>(null);

  const medie = pagellePartita(tutti, matchId);
  const miei = io ? mieiVoti(tutti, matchId, io.id) : {};
  const daVotare = convocati.filter((g) => g.id !== io?.id);
  const fatti = daVotare.filter((g) => miei[g.id] !== undefined).length;

  async function invia(votatoId: string, voto: number) {
    if (!io) return;
    setApertoPer(null);
    try {
      await vota.mutateAsync({ match_id: matchId, votante_id: io.id, votato_id: votatoId, voto });
      toast.success("Voto registrato (resta anonimo)");
    } catch {
      toast.error("Voto non riuscito, riprova");
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <ClipboardCheck className="h-3.5 w-3.5" /> Pagelle anonime
        </p>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold uppercase text-muted-foreground">
          {chiuse ? "Votazioni chiuse" : `${fatti}/${daVotare.length} votati`}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Dai un voto da 1 a 10 ai compagni: nessuno vedrà chi ha votato cosa, solo la media.
      </p>

      {isPending ? (
        <p aria-busy="true" className="mt-3 text-xs text-muted-foreground">
          Carico le pagelle…
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {convocati.map((g) => {
            const media = medie[g.id];
            const mio = miei[g.id];
            const sonoIo = g.id === io?.id;
            const aperto = apertoPer === g.id;
            return (
              <div key={g.id} className="rounded-2xl bg-secondary/60 p-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar id={g.id} fallback={String(g.numero)} className="h-8 w-8 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold leading-tight">{g.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {media ? `Media ${media.media} · ${media.voti} voti` : "Nessun voto"}
                    </span>
                  </span>
                  {sonoIo ? (
                    <span className="shrink-0 text-xs font-semibold uppercase text-muted-foreground">
                      Sei tu
                    </span>
                  ) : chiuse ? (
                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <button
                      type="button"
                      disabled={!io || vota.isPending}
                      onClick={() => setApertoPer(aperto ? null : g.id)}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase transition-colors disabled:opacity-50",
                        mio !== undefined
                          ? "bg-accent text-accent-foreground"
                          : "bg-card text-foreground",
                      )}
                    >
                      {mio !== undefined ? `Hai dato ${mio}` : "Vota"}
                    </button>
                  )}
                </div>
                {aperto && !chiuse ? (
                  <div className="mt-2 grid grid-cols-10 gap-1">
                    {voti.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => invia(g.id, v)}
                        className={cn(
                          "rounded-lg py-1.5 text-xs font-bold tabular-nums transition-transform active:scale-90",
                          mio === v
                            ? "bg-accent text-accent-foreground"
                            : "bg-card text-foreground",
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

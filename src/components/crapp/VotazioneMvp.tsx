import { useState } from "react";
import { Crown, Vote } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { nomeCompleto, useGiocatoriSquadra } from "@/lib/giocatori-squadra";
import { useGiocatoreCorrente } from "@/lib/user-store";
import { conteggioPartita, mioVoto, useVotaMvp, useVotiMvp, type VotoMvp } from "@/lib/mvp-voti";

/** Pannello di votazione MVP di una partita: un voto a testa, modificabile. */
export function VotazioneMvp({ matchId }: { matchId: string }) {
  const io = useGiocatoreCorrente();
  const voti = useVotiMvp();
  const vota = useVotaMvp();
  const { righe: squadra } = useGiocatoriSquadra();
  const rosa = squadra.filter((g) => g.attivo);
  const [aperto, setAperto] = useState(false);

  const tutti: VotoMvp[] = voti.data ?? [];
  const conteggio = conteggioPartita(tutti, matchId);
  const mio = io ? mioVoto(tutti, matchId, io.id) : null;
  const totale = conteggio.reduce((s, c) => s + c.voti, 0);
  const testa = conteggio[0];
  const pareggio = conteggio.length > 1 && conteggio[1]!.voti === testa?.voti;

  async function invia(id: string, nome: string) {
    if (!io) return;
    try {
      await vota.mutateAsync({
        match_id: matchId,
        votante_id: io.id,
        votato_id: id,
        votato_nome: nome,
      });
      setAperto(false);
      toast.success(`Voto MVP registrato: ${nome}`);
    } catch {
      toast.error("Voto non riuscito, riprova");
    }
  }

  return (
    <div className="mt-3 rounded-2xl bg-secondary/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <Vote className="h-3.5 w-3.5" /> Voto MVP · {totale} {totale === 1 ? "voto" : "voti"}
        </p>
        <button
          type="button"
          onClick={() => setAperto((v) => !v)}
          disabled={!io}
          className="rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase text-accent-foreground disabled:opacity-50"
        >
          {mio ? "Cambia voto" : "Vota"}
        </button>
      </div>

      <p className="mt-2 text-xs">
        {testa && !pareggio ? (
          <span className="inline-flex items-center gap-1 font-bold">
            <Crown className="h-3.5 w-3.5 text-warning" /> {testa.nome} ({testa.voti})
          </span>
        ) : (
          <span className="text-muted-foreground">
            {totale === 0 ? "Nessun voto: MVP da eleggere" : "Parità: servono altri voti"}
          </span>
        )}
      </p>
      {mio ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Hai votato {mio.votato_nome}</p>
      ) : null}

      {aperto ? (
        <div className="mt-3 grid max-h-60 grid-cols-2 gap-1.5 overflow-y-auto">
          {rosa.map((g) => (
            <button
              key={g.id}
              type="button"
              disabled={vota.isPending}
              onClick={() => invia(g.id, nomeCompleto(g))}
              className={cn(
                "truncate rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                mio?.votato_id === g.id
                  ? "bg-accent text-accent-foreground"
                  : "bg-card text-foreground",
              )}
            >
              {nomeCompleto(g)}
            </button>
          ))}
        </div>
      ) : conteggio.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {conteggio.map((c) => (
            <span key={c.id} className="rounded-lg bg-card px-2 py-1 text-[11px] font-semibold">
              {c.nome} · {c.voti}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

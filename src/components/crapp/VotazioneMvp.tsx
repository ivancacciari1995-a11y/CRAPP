import { useState } from "react";
import { Crown, Vote } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { inRosa, nomeCompleto, useGiocatoriSquadra } from "@/lib/giocatori-squadra";
import { useGiocatoreInCampo } from "@/lib/user-store";
import { usePresenzeEvento } from "@/lib/presenze";
import type { Evento } from "@/lib/eventi";
import {
  conteggioPartita,
  mioVoto,
  mvpPartita,
  ORE_ATTESA_MVP,
  useMieiVotiMvp,
  useVotaMvp,
  useVotiMvp,
  VOTI_MINIMI_MVP,
  votoMvpAperto,
  votoMvpChiuso,
  DURATA_VOTO_MVP_ORE,
  type VotoMvpPubblico,
} from "@/lib/mvp-voti";

/**
 * Pannello di votazione MVP di una partita: un voto a testa, definitivo. Con una parità in
 * testa gli MVP sono più d'uno.
 *
 * I voti sono legati all'evento CrAPP, non al referto CSI né allo scout: si vota anche
 * senza risultato caricato, dalle due ore dopo il fischio d'inizio. Votano e sono votabili
 * solo i presenti (o in ritardo) di quell'evento.
 */
export function VotazioneMvp({ evento }: { evento: Evento }) {
  const matchId = evento.id;
  // Solo `.id` serve qui, niente statistiche; `null` per l'allenatore, che non gioca (DD-034).
  const io = useGiocatoreInCampo();
  const voti = useVotiMvp();
  const miei = useMieiVotiMvp(io?.id);
  const vota = useVotaMvp();
  const { righe: squadra } = useGiocatoriSquadra();
  const { risposte } = usePresenzeEvento(evento.id);
  const presente = (id: string) => risposte[id] === "presente" || risposte[id] === "ritardo";
  const rosa = squadra.filter((g) => inRosa(g) && presente(g.id));
  const [aperto, setAperto] = useState(false);
  const [scelto, setScelto] = useState<{ id: string; nome: string } | null>(null);

  const tutti: VotoMvpPubblico[] = voti.data ?? [];
  const conteggio = conteggioPartita(tutti, matchId);
  const mio = io ? mioVoto(miei.data ?? [], matchId, io.id) : null;
  const chiuso = votoMvpChiuso(evento.data, evento.ora);
  const totale = conteggio.reduce((s, c) => s + c.voti, 0);
  const mvp = mvpPartita(tutti, matchId);
  const puoVotare = !!io && !mio && !chiuso && presente(io.id);

  if (!votoMvpAperto(evento.data, evento.ora)) {
    return (
      <div className="mt-3 rounded-2xl bg-secondary/60 p-3">
        <p className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
          <Vote className="h-3.5 w-3.5" /> Voto MVP
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Apre {ORE_ATTESA_MVP} ore dopo l'inizio della partita.
        </p>
      </div>
    );
  }

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
      setScelto(null);
      toast.success(`Voto MVP registrato: ${nome}`);
    } catch {
      toast.error("Voto non riuscito: se hai già votato, il voto non si può cambiare");
    }
  }

  return (
    <div className="mt-3 rounded-2xl bg-secondary/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
          <Vote className="h-3.5 w-3.5" /> Voto MVP · {totale} {totale === 1 ? "voto" : "voti"}
        </p>
        {mio || chiuso ? null : (
          <button
            type="button"
            onClick={() => setAperto((v) => !v)}
            disabled={!puoVotare}
            className="rounded-full bg-accent px-3 py-1 text-[13px] font-bold uppercase text-accent-foreground disabled:opacity-50"
          >
            Vota
          </button>
        )}
      </div>

      <p className="mt-2 text-[13px]">
        {mvp.length > 0 ? (
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 font-bold">
            {mvp.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1">
                <Crown className="h-3.5 w-3.5 text-warning" /> {c.nome} ({c.voti})
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {totale === 0
              ? "Nessun voto: MVP da eleggere"
              : `Servono almeno ${VOTI_MINIMI_MVP} voti per eleggere l'MVP`}
          </span>
        )}
      </p>
      {mio ? (
        <p className="mt-1 text-[13px] text-muted-foreground">
          Hai votato {mio.votato_nome}: il voto non si può cambiare.
        </p>
      ) : chiuso ? (
        <p className="mt-1 text-[13px] text-muted-foreground">Votazione chiusa.</p>
      ) : !puoVotare ? (
        <p className="mt-1 text-[13px] text-muted-foreground">
          Vota chi era presente a questa partita.
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-muted-foreground">
          Il voto è segreto e resta aperto {DURATA_VOTO_MVP_ORE} ore.
        </p>
      )}

      {aperto && !mio ? (
        <>
          <div className="mt-3 grid max-h-60 grid-cols-2 gap-1.5 overflow-y-auto">
            {/* Sé stessi fuori dall'elenco, come nei badge social: l'auto-voto è vietato
              anche dal vincolo `mvp_no_autovoto` (M12). */}
            {rosa
              .filter((g) => g.id !== io?.id)
              .map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={vota.isPending}
                  onClick={() => setScelto({ id: g.id, nome: nomeCompleto(g) })}
                  className={cn(
                    "truncate rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold transition-colors",
                    scelto?.id === g.id
                      ? "bg-accent text-accent-foreground"
                      : "bg-card text-foreground",
                  )}
                >
                  {nomeCompleto(g)}
                </button>
              ))}
          </div>
          <button
            type="button"
            disabled={!scelto || vota.isPending}
            onClick={() => scelto && invia(scelto.id, scelto.nome)}
            className="mt-2 w-full rounded-full bg-accent px-3 py-2 text-[13px] font-bold uppercase text-accent-foreground disabled:opacity-50"
          >
            {scelto ? `Conferma il voto per ${scelto.nome}` : "Scegli chi votare"}
          </button>
          <p className="mt-1 text-center text-[13px] text-muted-foreground">
            Il voto è definitivo: non si può cambiare.
          </p>
        </>
      ) : conteggio.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {conteggio.map((c) => (
            <span key={c.id} className="rounded-lg bg-card px-2 py-1 text-[13px] font-semibold">
              {c.nome} · {c.voti}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

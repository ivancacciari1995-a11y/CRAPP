import { useState } from "react";
import { Check, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { giocatori } from "@/lib/crapp-data";
import { useGiocatoreCorrente } from "@/lib/user-store";
import {
  categorieSocial,
  conteggioCategoria,
  mioVotoSocial,
  useVotaSocial,
  useVotiSocial,
  vincitoreCategoria,
} from "@/lib/badge-social";

/** Voto social post-partita: un compagno per categoria, veloce da mobile. */
export function VotoSocial({ matchId }: { matchId: string }) {
  const io = useGiocatoreCorrente();
  const voti = useVotiSocial();
  const vota = useVotaSocial();
  const [aperta, setAperta] = useState<string | null>(null);

  const tutti = voti.data ?? [];
  const fatti = io
    ? categorieSocial.filter((c) => mioVotoSocial(tutti, matchId, c.id, io.id)).length
    : 0;

  async function invia(categoria: string, id: string, nome: string) {
    if (!io) return;
    if (id === io.id) {
      toast.error("Non puoi votare te stesso");
      return;
    }
    try {
      await vota.mutateAsync({
        match_id: matchId,
        categoria,
        votante_id: io.id,
        votato_id: id,
        votato_nome: nome,
      });
      setAperta(null);
      toast.success(`Voto registrato: ${nome}`);
    } catch {
      toast.error("Voto non riuscito, riprova");
    }
  }

  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-secondary/60 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Hai votato {fatti}/{categorieSocial.length} categorie · un solo voto per categoria
        </span>
      </div>

      {categorieSocial.map((cat) => {
        const Icon = cat.icon;
        const mio = io ? mioVotoSocial(tutti, matchId, cat.id, io.id) : null;
        const vincitore = vincitoreCategoria(tutti, matchId, cat.id);
        const conteggio = conteggioCategoria(tutti, matchId, cat.id);
        const totale = conteggio.reduce((s, c) => s + c.voti, 0);
        const isOpen = aperta === cat.id;

        return (
          <div key={cat.id} className="overflow-hidden rounded-3xl bg-card shadow-card">
            <button
              type="button"
              onClick={() => setAperta(isOpen ? null : cat.id)}
              disabled={!io}
              className="flex w-full items-center gap-3 p-3 text-left active:scale-[0.99] disabled:opacity-60"
              aria-expanded={isOpen}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-lg">
                {cat.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold leading-tight">{cat.nome}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {mio ? `Hai votato ${mio.votato_nome}` : cat.descrizione}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase",
                  mio ? "bg-success text-success-foreground" : "bg-accent text-accent-foreground",
                )}
              >
                {mio ? <Check className="h-3 w-3" /> : "Vota"}
              </span>
            </button>

            {isOpen ? (
              <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto border-t border-border p-3">
                {giocatori
                  .filter((g) => g.id !== io?.id)
                  .map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      disabled={vota.isPending}
                      onClick={() => invia(cat.id, g.id, g.nome)}
                      className={cn(
                        "truncate rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                        mio?.votato_id === g.id
                          ? "bg-accent text-accent-foreground"
                          : "bg-secondary text-foreground",
                      )}
                    >
                      {g.nome}
                    </button>
                  ))}
              </div>
            ) : (
              <div className="border-t border-border px-3 py-2">
                {totale === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Nessun voto ancora: apri e scegli un compagno.
                  </p>
                ) : vincitore ? (
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold">
                    <Crown className="h-3.5 w-3.5 text-oro" />
                    <Icon className="h-3.5 w-3.5 text-accent" />
                    {vincitore.nome} · {vincitore.voti} {vincitore.voti === 1 ? "voto" : "voti"}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Parità con {totale} voti: servono altri voti per assegnare il badge.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

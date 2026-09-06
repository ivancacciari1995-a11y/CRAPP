import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Campo, classiInput, PageHeader, Section } from "@/components/crapp/ui-bits";
import { formatData } from "@/lib/crapp-data";
import { nomeCompleto, useGiocatoriSquadra } from "@/lib/giocatori-squadra";
import {
  categoriaEvento,
  daCategoria,
  eventoVuoto,
  useEliminaEvento,
  useEventi,
  useSalvaEvento,
  type CategoriaEvento,
  type Evento,
} from "@/lib/eventi";
import { useGiocatoreCorrente } from "@/lib/user-store";
import { useIsAdmin } from "@/lib/ruoli";

export const Route = createFileRoute("/eventi")({
  head: () => ({
    meta: [
      { title: "Gestione eventi — CrAPP" },
      {
        name: "description",
        content:
          "Area riservata ai referenti CRAP Volley: crea, modifica ed elimina allenamenti, partite ed eventi di squadra.",
      },
      { property: "og:title", content: "Gestione eventi — CrAPP" },
      {
        property: "og:description",
        content: "Crea e modifica il calendario della squadra e scegli i convocati.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GestioneEventi,
});

const tipi: Array<{ id: CategoriaEvento; label: string }> = [
  { id: "allenamento", label: "Allenamento" },
  { id: "partita", label: "Partita" },
  { id: "amichevole", label: "Amichevole" },
  { id: "evento", label: "Evento" },
];

function GestioneEventi() {
  const io = useGiocatoreCorrente();
  const admin = useIsAdmin();
  const { eventi, isPending } = useEventi();
  const { righe: squadra } = useGiocatoriSquadra();
  const salva = useSalvaEvento();
  const elimina = useEliminaEvento();
  const [bozza, setBozza] = useState<Evento | null>(null);
  const rosa = squadra.filter((g) => g.attivo);

  if (!io || !admin) {
    return (
      <>
        <PageHeader titolo="Gestione eventi" sottotitolo="Area riservata" />
        <div className="px-5">
          <p className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
            Solo i referenti della squadra possono creare o modificare gli eventi.
          </p>
        </div>
      </>
    );
  }

  function aggiorna(patch: Partial<Evento>) {
    setBozza((b) => (b ? { ...b, ...patch } : b));
  }

  async function conferma() {
    if (!bozza) return;
    if (!bozza.titolo.trim()) {
      toast.error("Serve un titolo per l'evento");
      return;
    }
    try {
      await salva.mutateAsync({ ...bozza, titolo: bozza.titolo.trim() });
      toast.success("Evento salvato");
      setBozza(null);
    } catch {
      toast.error("Non sono riuscito a salvare l'evento");
    }
  }

  async function rimuovi(id: string) {
    try {
      await elimina.mutateAsync(id);
      toast.success("Evento eliminato");
      if (bozza?.id === id) setBozza(null);
    } catch {
      toast.error("Non sono riuscito a eliminare l'evento");
    }
  }

  return (
    <>
      <PageHeader titolo="Gestione eventi" sottotitolo={`${eventi.length} eventi in calendario`} />

      <div className="px-5 pt-4">
        <button
          type="button"
          onClick={() => setBozza(eventoVuoto())}
          className="premi flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-grad py-3 text-sm font-bold uppercase text-accent-foreground shadow-pop"
        >
          <CalendarPlus className="h-4 w-4" /> Nuovo evento
        </button>
      </div>

      {bozza ? (
        <Section
          titolo={eventi.some((e) => e.id === bozza.id) ? "Modifica evento" : "Nuovo evento"}
        >
          <div className="space-y-3 rounded-3xl bg-card p-4 shadow-card">
            <div className="grid grid-cols-4 gap-1 rounded-full bg-secondary p-1">
              {tipi.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => aggiorna(daCategoria(t.id))}
                  className={cn(
                    "rounded-full py-2 text-xs font-bold uppercase transition-colors",
                    categoriaEvento(bozza) === t.id
                      ? "bg-card shadow-card text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <Campo label="Titolo">
              <input
                value={bozza.titolo}
                maxLength={80}
                onChange={(e) => aggiorna({ titolo: e.target.value })}
                placeholder="Es. CRAP Volley vs Aurora Nera"
                className={classiInput}
              />
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo label="Data">
                <input
                  type="date"
                  value={bozza.data}
                  onChange={(e) => aggiorna({ data: e.target.value })}
                  className={classiInput}
                />
              </Campo>
              <Campo label="Ora">
                <input
                  type="time"
                  value={bozza.ora}
                  onChange={(e) => aggiorna({ ora: e.target.value })}
                  className={classiInput}
                />
              </Campo>
            </div>

            <Campo label="Luogo">
              <input
                value={bozza.luogo}
                maxLength={80}
                onChange={(e) => aggiorna({ luogo: e.target.value })}
                className={classiInput}
              />
            </Campo>

            <Campo label="Note">
              <textarea
                value={bozza.note}
                maxLength={300}
                rows={2}
                onChange={(e) => aggiorna({ note: e.target.value })}
                className={cn(classiInput, "h-auto")}
              />
            </Campo>

            {bozza.tipo === "partita" ? (
              <>
                <Campo label="Dove si gioca">
                  <div className="flex rounded-full bg-secondary p-1">
                    {[
                      { casa: true, label: "In casa" },
                      { casa: false, label: "Fuori casa" },
                    ].map((o) => (
                      <button
                        key={o.label}
                        type="button"
                        onClick={() => aggiorna({ casa: o.casa })}
                        className={cn(
                          "flex-1 rounded-full py-2 text-xs font-bold uppercase transition-colors",
                          bozza.casa === o.casa
                            ? "bg-card shadow-card text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </Campo>
                <div className="flex flex-wrap gap-2">
                  <Interruttore
                    attivo={bozza.pagelleChiuse}
                    onClick={() => aggiorna({ pagelleChiuse: !bozza.pagelleChiuse })}
                    label="Pagelle chiuse"
                  />
                </div>
              </>
            ) : null}

            <Campo
              label={`Convocati (${bozza.convocati.length === 0 ? "tutta la rosa" : bozza.convocati.length})`}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {rosa.map((g) => {
                  const scelto = bozza.convocati.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() =>
                        aggiorna({
                          convocati: scelto
                            ? bozza.convocati.filter((x) => x !== g.id)
                            : [...bozza.convocati, g.id],
                        })
                      }
                      className={cn(
                        "truncate rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                        scelto
                          ? "bg-accent text-accent-foreground"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {nomeCompleto(g)}
                    </button>
                  );
                })}
              </div>
            </Campo>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBozza(null)}
                className="flex-1 rounded-2xl bg-secondary py-3 text-sm font-bold uppercase"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={conferma}
                disabled={salva.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent-grad py-3 text-sm font-bold uppercase text-accent-foreground shadow-pop disabled:opacity-50"
              >
                {salva.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salva
              </button>
            </div>
          </div>
        </Section>
      ) : null}

      <Section titolo="Eventi in calendario">
        {isPending ? (
          <p aria-busy="true" className="text-center text-xs text-muted-foreground">
            Carico gli eventi…
          </p>
        ) : (
          <div className="space-y-2">
            {eventi.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-3xl bg-card p-3 shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold leading-tight">{e.titolo}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatData(e.data)} · {e.ora} · {e.luogo || "luogo da definire"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBozza(e)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-foreground active:scale-95"
                  aria-label={`Modifica ${e.titolo}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => rimuovi(e.id)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive active:scale-95"
                  aria-label={`Elimina ${e.titolo}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function Interruttore({
  attivo,
  onClick,
  label,
}: {
  attivo: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-bold uppercase transition-colors",
        attivo ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

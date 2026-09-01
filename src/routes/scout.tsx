import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Undo2, Save, CheckCircle2, Radio, Lock, CalendarX2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { giocatori, formatData } from "@/lib/crapp-data";
import type { Evento } from "@/lib/eventi";
import { useGiocatoreCorrente } from "@/lib/user-store";
import { useIsAdmin } from "@/lib/ruoli";
import { usePresenzeEvento } from "@/lib/presenze";
import {
  statoIniziale,
  useCancellaStatoScout,
  useSalvaStatoScout,
  useStatoScout,
  type StatoScout,
} from "@/lib/scout-stato";
import {
  SCADENZA_MINUTI,
  sessioneScaduta,
  useApriSessioneScout,
  useChiudiSessioneScout,
  useHeartbeatScout,
  usePartitaDiOggi,
  useSessioneScout,
} from "@/lib/scout-live";
import {
  azioniMeta,
  useSalvaScoutMatch,
  totaliPerGiocatore,
  type Azione,
  type AzioneTipo,
} from "@/lib/scout-store";

export const Route = createFileRoute("/scout")({
  head: () => ({
    meta: [
      { title: "Scout live partita — CrAPP" },
      {
        name: "description",
        content:
          "Registra punti, ace, muri ed errori del CRAP Volley in tempo reale durante la partita.",
      },
      { property: "og:title", content: "Scout live partita — CrAPP" },
      {
        property: "og:description",
        content: "Un tap per giocatore e azione: le stats finiscono subito nel database squadra.",
      },
    ],
  }),
  component: Scout,
});

const ordineAzioni: AzioneTipo[] = ["attacco", "ace", "muro", "errore"];

function Blocco({
  icona,
  titolo,
  testo,
  children,
}: {
  icona: React.ReactNode;
  titolo: string;
  testo: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-10">
      <div className="rounded-3xl bg-card p-6 text-center shadow-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-accent">
          {icona}
        </div>
        <h1 className="mt-4 font-display text-2xl uppercase leading-none">{titolo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{testo}</p>
        {children}
      </div>
    </div>
  );
}

function Scout() {
  const { pronto, partita } = usePartitaDiOggi();
  const io = useGiocatoreCorrente();
  const admin = useIsAdmin();
  const sessione = useSessioneScout(partita?.id ?? null);
  const statoSalvato = useStatoScout(partita?.id ?? null);
  const apri = useApriSessioneScout();
  const chiudi = useChiudiSessioneScout();
  const [controllo, setControllo] = useState(false);

  useHeartbeatScout(partita?.id ?? null, io?.id ?? null, controllo);

  useEffect(() => {
    if (!controllo || !partita || !io) return;
    const rilascia = () => {
      void chiudi.mutateAsync({ eventoId: partita.id, giocatoreId: io.id });
    };
    window.addEventListener("pagehide", rilascia);
    return () => window.removeEventListener("pagehide", rilascia);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllo, partita?.id, io?.id]);

  if (io && !admin) {
    return (
      <Blocco
        icona={<Lock className="h-6 w-6" />}
        titolo="Scout riservato"
        testo="Lo scout live è uno strumento tecnico per allenatori e referenti della squadra."
      />
    );
  }

  if (!pronto || sessione.isLoading || statoSalvato.isLoading) {
    return (
      <Blocco icona={<Radio className="h-6 w-6" />} titolo="Scout live" testo="Caricamento…" />
    );
  }

  if (!partita) {
    return (
      <Blocco
        icona={<CalendarX2 className="h-6 w-6" />}
        titolo="Nessuna partita oggi"
        testo="Lo scout live si attiva automaticamente il giorno della partita."
      />
    );
  }

  const attiva = sessione.data && !sessioneScaduta(sessione.data) ? sessione.data : null;
  const occupataDaAltri = !!attiva && attiva.giocatore_id !== io?.id;
  const ripresa = !!statoSalvato.data && statoSalvato.data.azioni.length > 0;

  if (!controllo) {
    return (
      <Blocco
        icona={occupataDaAltri ? <Lock className="h-6 w-6" /> : <Radio className="h-6 w-6" />}
        titolo={occupataDaAltri ? "Scout occupato" : "Scout live disponibile"}
        testo={
          occupataDaAltri
            ? `${attiva!.giocatore_nome} sta già scoutando questa partita. Si libera dopo ${SCADENZA_MINUTI} minuti di inattività.`
            : ripresa
              ? `${partita.titolo} · scout già avviato: riprendi da dove è stato lasciato.`
              : `${partita.titolo} · ${formatData(partita.data)} ore ${partita.ora}`
        }
      >
        {occupataDaAltri ? (
          <button
            type="button"
            onClick={() => sessione.refetch()}
            className="mt-5 w-full rounded-2xl bg-secondary py-3 text-sm font-bold uppercase"
          >
            Aggiorna
          </button>
        ) : (
          <button
            type="button"
            disabled={apri.isPending || !io}
            onClick={async () => {
              if (!io) return;
              const ok = await apri.mutateAsync({
                eventoId: partita.id,
                giocatoreId: io.id,
                nome: io.nome,
              });
              if (ok) setControllo(true);
              else toast.error("Un altro compagno ha appena preso lo scout");
            }}
            className="mt-5 w-full rounded-2xl bg-accent-grad py-3 text-sm font-bold uppercase text-accent-foreground shadow-pop disabled:opacity-50"
          >
            {ripresa ? "Riprendi lo scout" : "Prendi il controllo"}
          </button>
        )}
      </Blocco>
    );
  }

  return (
    <ScoutBoard
      partita={partita}
      iniziale={statoSalvato.data ?? null}
      onFine={() => {
        setControllo(false);
        if (io) void chiudi.mutateAsync({ eventoId: partita.id, giocatoreId: io.id });
      }}
    />
  );
}

function ScoutBoard({
  partita,
  iniziale,
  onFine,
}: {
  partita: Evento;
  iniziale: StatoScout | null;
  onFine: () => void;
}) {
  const navigate = useNavigate();
  const base =
    iniziale ??
    statoIniziale(
      partita.titolo
        .replace(/CRAP Volley/gi, "")
        .replace(/\s*vs\s*/i, "")
        .trim() || "Avversario",
      partita.titolo.trim().toLowerCase().startsWith("crap"),
    );
  const [avversario, setAvversario] = useState(base.avversario);
  const [casa, setCasa] = useState(base.casa);
  const [setChiusi, setSetChiusi] = useState<Array<[number, number]>>(base.setChiusi);
  const [azioni, setAzioni] = useState<Azione[]>(base.azioni);
  const [selezionato, setSelezionato] = useState<string | null>(null);
  const salva = useSalvaStatoScout();
  const cancella = useCancellaStatoScout();
  const salvaMatch = useSalvaScoutMatch();
  const { risposte } = usePresenzeEvento(partita.id);
  const finito = useRef(false);

  /** In campo solo chi ha confermato la presenza (anche in ritardo). */
  const convocati = useMemo(() => {
    const presenti = giocatori.filter(
      (g) => risposte[g.id] === "presente" || risposte[g.id] === "ritardo",
    );
    return presenti.length > 0 ? presenti : giocatori;
  }, [risposte]);

  // Salvataggio condiviso: se chi scouta si disconnette, il prossimo riprende da qui.
  useEffect(() => {
    if (finito.current) return;
    const id = window.setTimeout(() => {
      void salva.mutateAsync({
        eventoId: partita.id,
        stato: { azioni, setChiusi, avversario, casa },
      });
    }, 800);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [azioni, setChiusi, avversario, casa, partita.id]);

  const setCorrente = setChiusi.length + 1;
  const azioniSet = azioni.filter((a) => a.set === setCorrente);
  const puntiNoi = azioniSet.filter((a) => azioniMeta[a.tipo].nostro).length;
  const puntiLoro = azioniSet.length - puntiNoi;
  const setNostri = setChiusi.filter(([n, l]) => n > l).length;
  const setLoro = setChiusi.length - setNostri;
  const totali = useMemo(() => totaliPerGiocatore(azioni), [azioni]);

  function registra(tipo: AzioneTipo) {
    const meta = azioniMeta[tipo];
    if (meta.richiedeGiocatore && !selezionato) {
      toast.error("Seleziona prima il giocatore");
      return;
    }
    setAzioni((prev) => {
      const nuova: Azione = {
        id: `${Date.now()}-${prev.length}`,
        tipo,
        set: setCorrente,
        ts: Date.now(),
        ...(meta.richiedeGiocatore && selezionato ? { giocatoreId: selezionato } : {}),
      };
      return [...prev, nuova];
    });
  }

  function annulla() {
    const ultima = azioni[azioni.length - 1];
    if (!ultima || ultima.set !== setCorrente) {
      toast.error("Puoi annullare solo le azioni del set in corso");
      return;
    }
    setAzioni((prev) => prev.slice(0, -1));
  }

  function chiudiSet() {
    if (puntiNoi === 0 && puntiLoro === 0) {
      toast.error("Set senza azioni");
      return;
    }
    setSetChiusi((prev) => [...prev, [puntiNoi, puntiLoro]]);
    toast.success(`Set ${setCorrente} chiuso ${puntiNoi}-${puntiLoro}`);
  }

  async function finePartita() {
    const parziali: Array<[number, number]> =
      puntiNoi + puntiLoro > 0 ? [...setChiusi, [puntiNoi, puntiLoro]] : setChiusi;
    if (parziali.length === 0) {
      toast.error("Nessun set da salvare");
      return;
    }
    const vinti = parziali.filter(([n, l]) => n > l).length;
    try {
      await salvaMatch.mutateAsync({
        eventoId: partita.id,
        match: {
          id: `s${Date.now()}`,
          data: new Date().toISOString().slice(0, 10),
          avversario: avversario.trim() || "Avversario",
          casa,
          setNostri: vinti,
          setLoro: parziali.length - vinti,
          parziali,
          azioni,
        },
      });
    } catch {
      toast.error("Salvataggio non riuscito, riprova");
      return;
    }
    toast.success("Partita salvata: ora la squadra può votare l'MVP");
    finito.current = true;
    void cancella.mutateAsync(partita.id);
    onFine();
    navigate({ to: "/squadra" });
  }

  const ultime = [...azioni].slice(-4).reverse();

  return (
    <>
      <header className="sticky top-0 z-30 bg-hero px-5 pb-4 pt-6 text-primary-foreground">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
            <Radio className="h-3 w-3 text-accent" /> Scout live · Set {setCorrente}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={annulla}
              disabled={azioniSet.length === 0}
              className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" /> Annulla
            </button>
            <button
              type="button"
              onClick={onFine}
              className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-bold"
            >
              <LogOut className="h-3.5 w-3.5" /> Rilascia
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase text-primary-foreground/60">CRAP Volley</p>
            <p className="font-display text-5xl leading-none text-accent">{puntiNoi}</p>
          </div>
          <p className="font-display text-2xl leading-none text-primary-foreground/50">
            {setNostri}-{setLoro}
          </p>
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase text-primary-foreground/60">
              {avversario || "Avversario"}
            </p>
            <p className="font-display text-5xl leading-none">{puntiLoro}</p>
          </div>
        </div>

        {setChiusi.length > 0 ? (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {setChiusi.map((p, i) => (
              <span
                key={i}
                className="rounded-lg bg-primary-foreground/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums"
              >
                {p[0]}-{p[1]}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <section className="px-5 pt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          1. Tocca il giocatore
        </p>
        <div className="grid grid-cols-4 gap-2">
          {convocati.map((g) => {
            const attivo = selezionato === g.id;
            const t = totali.get(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelezionato(attivo ? null : g.id)}
                className={cn(
                  "rounded-2xl p-2 text-center transition-all active:scale-95",
                  attivo ? "bg-accent text-accent-foreground shadow-pop" : "bg-card shadow-card",
                )}
              >
                <p className="font-display text-2xl leading-none">{g.numero}</p>
                <p className="mt-1 text-[10px] font-bold leading-tight">{g.nome}</p>
                <p
                  className={cn(
                    "text-[10px] tabular-nums",
                    attivo ? "text-accent-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {t ? `${t.punti}p` : "0p"}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-5 pt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          2. Tocca l'azione
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ordineAzioni.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => registra(tipo)}
              className={cn(
                "rounded-2xl py-4 font-display text-xl uppercase tracking-wide shadow-card transition-transform active:scale-95",
                azioniMeta[tipo].className,
                !selezionato && "opacity-50",
              )}
            >
              {azioniMeta[tipo].label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["punto_avv", "errore_avv"] as AzioneTipo[]).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => registra(tipo)}
              className={cn(
                "rounded-2xl py-3 text-sm font-bold uppercase shadow-card transition-transform active:scale-95",
                azioniMeta[tipo].className,
              )}
            >
              {azioniMeta[tipo].short}
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 pt-4">
        <div className="rounded-3xl bg-card p-3 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Ultime azioni
          </p>
          {ultime.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Nessuna azione registrata.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {ultime.map((a, i) => {
                const g = giocatori.find((x) => x.id === a.giocatoreId);
                return (
                  <li
                    key={a.id}
                    className={cn(
                      "flex items-center justify-between gap-2 px-1 text-xs",
                      i === 0 && "anim-riga",
                    )}
                  >
                    <span className="truncate">{g ? `#${g.numero} ${g.nome}` : "Avversario"}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        azioniMeta[a.tipo].className,
                      )}
                    >
                      {azioniMeta[a.tipo].short}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="px-5 pt-4">
        <div className="rounded-3xl bg-card p-4 shadow-card">
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Avversario
          </label>
          <input
            value={avversario}
            maxLength={40}
            onChange={(e) => setAvversario(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="mt-3 flex rounded-full bg-secondary p-1">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setCasa(v)}
                className={cn(
                  "flex-1 rounded-full py-1.5 text-xs font-bold uppercase",
                  casa === v ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
                )}
              >
                {v ? "In casa" : "Trasferta"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 px-5 pb-4 pt-4">
        <button
          type="button"
          onClick={chiudiSet}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-sm font-bold uppercase"
        >
          <CheckCircle2 className="h-4 w-4" /> Chiudi set
        </button>
        <button
          type="button"
          onClick={finePartita}
          disabled={salvaMatch.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-grad py-3 text-sm font-bold uppercase text-accent-foreground shadow-pop disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Fine partita
        </button>
      </section>
    </>
  );
}

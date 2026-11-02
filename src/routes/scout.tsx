import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Undo2, Save, CheckCircle2, Radio, Lock, CalendarX2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Select } from "@/components/crapp/ui-bits";
import { formatData } from "@/lib/crapp-data";
import type { Evento } from "@/lib/eventi";
import { useAnagraficaRosa } from "@/lib/rosa";
import { useGiocatoreBase } from "@/lib/user-store";
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
  contaPiuSenzaRicezione,
  contaValutazioni,
  parzialiFinali,
  fondamentali,
  useSalvaScoutMatch,
  type Azione,
  type AzioneTipo,
  type Fondamentale,
  type Valutazione,
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
        <p className="mt-2 text-[15px] text-muted-foreground">{testo}</p>
        {children}
      </div>
    </div>
  );
}

function Scout() {
  const { pronto, partita } = usePartitaDiOggi();
  // Solo `.id`/`.nome` servono qui: `useGiocatoreBase` basta, niente statistiche.
  const io = useGiocatoreBase();
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
  const ripresa =
    !!statoSalvato.data &&
    (statoSalvato.data.azioni.length > 0 ||
      (statoSalvato.data.valutazioni?.length ?? 0) > 0 ||
      statoSalvato.data.setChiusi.length > 0);

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
            className="mt-5 w-full rounded-2xl bg-secondary py-3 text-[15px] font-bold uppercase"
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
            className="mt-5 w-full rounded-2xl bg-accent-grad py-3 text-[15px] font-bold uppercase text-accent-foreground shadow-pop disabled:opacity-50"
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
  const [avversario] = useState(base.avversario);
  const [casa] = useState(base.casa);
  const [setChiusi, setSetChiusi] = useState<Array<[number, number]>>(base.setChiusi);
  const [azioni, setAzioni] = useState<Azione[]>(base.azioni);
  const [valutazioni, setValutazioni] = useState<Valutazione[]>(base.valutazioni ?? []);
  const [ordine, setOrdine] = useState<"cognome" | "numero">("cognome");
  const [selezionato, setSelezionato] = useState<string | null>(null);
  const salva = useSalvaStatoScout();
  const cancella = useCancellaStatoScout();
  const salvaMatch = useSalvaScoutMatch();
  const { risposte } = usePresenzeEvento(partita.id);
  // Solo id/nome/numero servono (selezione e display): niente statistiche di squadra.
  const rosa = useAnagraficaRosa();
  const finito = useRef(false);
  const codaSalvataggio = useRef<Promise<unknown>>(Promise.resolve());

  /** In campo solo chi ha confermato la presenza (anche in ritardo). */
  const convocati = useMemo(() => {
    const presenti = rosa.filter(
      (g) => risposte[g.id] === "presente" || risposte[g.id] === "ritardo",
    );
    const elenco = presenti.length > 0 ? presenti : rosa;
    return [...elenco].sort((a, b) =>
      ordine === "numero"
        ? a.numero - b.numero
        : a.cognome.localeCompare(b.cognome, "it") || a.numero - b.numero,
    );
  }, [risposte, rosa, ordine]);

  // Salvataggio condiviso: se chi scouta si disconnette, il prossimo riprende da qui.
  useEffect(() => {
    if (finito.current) return;
    // Subito a ogni tocco, non dopo una pausa: così non resta nulla in sospeso se l'app si
    // chiude. Il salvataggio è sempre lo stato intero, quindi uno riuscito dopo uno fallito
    // rimette a posto tutto; la coda li tiene in ordine.
    const stato = { azioni, valutazioni, setChiusi, avversario, casa };
    codaSalvataggio.current = codaSalvataggio.current
      .then(() => salva.mutateAsync({ eventoId: partita.id, stato }))
      .then(() => {
        toast.dismiss("scout-salvataggio");
      })
      .catch(() => {
        toast.error("Salvataggio non riuscito: controlla la connessione", {
          id: "scout-salvataggio",
          duration: Infinity,
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [azioni, valutazioni, setChiusi, avversario, casa, partita.id]);

  const setCorrente = setChiusi.length + 1;
  const azioniSet = azioni.filter((a) => a.set === setCorrente);
  const puntiNoi = azioniSet.filter((a) => azioniMeta[a.tipo].nostro).length;
  const puntiLoro = azioniSet.length - puntiNoi;
  const setHaDati = azioniSet.length > 0 || valutazioni.some((v) => v.set === setCorrente);

  function valuta(fondamentale: Fondamentale, segno: Valutazione["segno"]) {
    if (!selezionato) {
      toast.error("Seleziona prima il giocatore");
      return;
    }
    setValutazioni((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        giocatoreId: selezionato,
        fondamentale,
        segno,
        set: setCorrente,
        ts: Date.now(),
      },
    ]);
  }

  function annullaValutazione() {
    const ultima = valutazioni[valutazioni.length - 1];
    if (!ultima || ultima.set !== setCorrente) {
      toast.error("Puoi annullare solo le valutazioni del set in corso");
      return;
    }
    setValutazioni((prev) => prev.slice(0, -1));
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
    if (!setHaDati) {
      toast.error("Set senza valutazioni");
      return;
    }
    setSetChiusi((prev) => [...prev, [puntiNoi, puntiLoro]]);
    toast.success(`Set ${setCorrente} chiuso`);
  }

  async function finePartita() {
    const parziali = parzialiFinali(setChiusi, [puntiNoi, puntiLoro], setHaDati);
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
          valutazioni,
        },
      });
    } catch {
      toast.error("Salvataggio non riuscito, riprova");
      return;
    }
    toast.success("Partita salvata");
    finito.current = true;
    void cancella.mutateAsync(partita.id);
    onFine();
    navigate({ to: "/squadra" });
  }

  const giocatoreSel = rosa.find((g) => g.id === selezionato);
  const contiSelezionato = selezionato
    ? contaValutazioni(valutazioni, selezionato, setCorrente)
    : null;
  const ultime = [...azioni].slice(-4).reverse();

  return (
    <>
      <header className="sticky top-0 z-30 bg-hero px-5 pb-4 pt-6 text-primary-foreground">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[13px] font-bold uppercase tracking-wide">
            <Radio className="h-3 w-3 text-accent" /> Scout live · Set {setCorrente}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={annulla}
              disabled={azioniSet.length === 0}
              className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-[13px] font-bold disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" /> Annulla
            </button>
            <button
              type="button"
              onClick={onFine}
              className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-[13px] font-bold"
            >
              <LogOut className="h-3.5 w-3.5" /> Rilascia
            </button>
          </div>
        </div>
      </header>

      <section className="px-5 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
            Selezione giocatore
          </p>
          <div className="w-40 shrink-0">
            <Select
              value={ordine}
              onChange={(e) => setOrdine(e.target.value as "cognome" | "numero")}
              aria-label="Ordina i giocatori"
            >
              <option value="cognome">Per cognome</option>
              <option value="numero">Per numero</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {convocati.map((g) => {
            const attivo = selezionato === g.id;
            const piu = contaPiuSenzaRicezione(valutazioni, g.id, setCorrente);
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
                <p className="mt-1 text-[13px] font-bold leading-tight">{g.nome}</p>
                <p
                  className={cn(
                    "text-[13px] tabular-nums",
                    attivo ? "text-accent-foreground/70" : "text-muted-foreground",
                  )}
                >
                  +{piu}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-5 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
            2. Valuta{giocatoreSel ? ` ${giocatoreSel.cognome} - ${giocatoreSel.numero}` : ""} · Set{" "}
            {setCorrente}
          </p>
          <button
            type="button"
            onClick={annullaValutazione}
            disabled={!valutazioni.some((v) => v.set === setCorrente)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-[13px] font-bold disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" /> Annulla
          </button>
        </div>
        <div
          className={cn(
            "space-y-2 rounded-3xl bg-card p-3 shadow-card",
            !selezionato && "opacity-60",
          )}
        >
          {!selezionato ? (
            <p className="text-[13px] text-muted-foreground">
              Tocca un giocatore: i + e i − non cambiano il punteggio.
            </p>
          ) : null}
          {fondamentali.map((f) => {
            const c = contiSelezionato?.[f.id] ?? { piu: 0, meno: 0 };
            return (
              <div key={f.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                <span className="text-[15px] font-bold">{f.label}</span>
                <button
                  type="button"
                  aria-label={`${f.label}: meno`}
                  onClick={() => valuta(f.id, "-")}
                  className="min-w-16 rounded-2xl bg-destructive px-4 py-2.5 font-display text-xl leading-none text-destructive-foreground shadow-card transition-transform active:scale-95"
                >
                  − <span className="tabular-nums">{c.meno}</span>
                </button>
                <button
                  type="button"
                  aria-label={`${f.label}: più`}
                  onClick={() => valuta(f.id, "+")}
                  className="min-w-16 rounded-2xl bg-success px-4 py-2.5 font-display text-xl leading-none text-success-foreground shadow-card transition-transform active:scale-95"
                >
                  + <span className="tabular-nums">{c.piu}</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-5 pt-4">
        <div className="rounded-3xl bg-card p-3 shadow-card">
          <p className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
            Ultime azioni
          </p>
          {ultime.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted-foreground">Nessuna azione registrata.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {ultime.map((a, i) => {
                const g = rosa.find((x) => x.id === a.giocatoreId);
                return (
                  <li
                    key={a.id}
                    className={cn(
                      "flex items-center justify-between gap-2 px-1 text-[13px]",
                      i === 0 && "anim-riga",
                    )}
                  >
                    <span className="truncate">{g ? `#${g.numero} ${g.nome}` : "Avversario"}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[13px] font-bold uppercase",
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

      <section className="grid grid-cols-2 gap-2 px-5 pb-4 pt-4">
        <button
          type="button"
          onClick={chiudiSet}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-[15px] font-bold uppercase"
        >
          <CheckCircle2 className="h-4 w-4" /> Chiudi set
        </button>
        <button
          type="button"
          onClick={finePartita}
          disabled={salvaMatch.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-grad py-3 text-[15px] font-bold uppercase text-accent-foreground shadow-pop disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Fine partita
        </button>
      </section>
    </>
  );
}

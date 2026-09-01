import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { EventoCard, linkPerEvento } from "@/components/crapp/EventoCard";
import { PageHeader, Section } from "@/components/crapp/ui-bits";
import { compleanniEventi, useEventi, type Evento } from "@/lib/eventi";
import { useGiocatoreCorrente } from "@/lib/user-store";
import { useIsAdmin } from "@/lib/ruoli";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendario squadra — CrAPP" },
      {
        name: "description",
        content: "Allenamenti, partite ed eventi extra del CRAP Volley con vista mensile e lista.",
      },
      { property: "og:title", content: "Calendario squadra — CrAPP" },
      {
        property: "og:description",
        content: "Vista mensile e lista eventi con promemoria per la squadra.",
      },
    ],
  }),
  component: Calendario,
});

const giorniIT = ["L", "M", "M", "G", "V", "S", "D"];
const mesiIT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
] as const;

function useMeseNav(initial?: { anno: number; mese: number }) {
  const oggi = new Date();
  const [anno, setAnno] = useState(initial?.anno ?? oggi.getFullYear());
  const [mese, setMese] = useState(initial?.mese ?? oggi.getMonth());

  const precedente = () => {
    if (mese === 0) {
      setMese(11);
      setAnno((a) => a - 1);
    } else {
      setMese((m) => m - 1);
    }
  };

  const successivo = () => {
    if (mese === 11) {
      setMese(0);
      setAnno((a) => a + 1);
    } else {
      setMese((m) => m + 1);
    }
  };

  return { anno, mese, precedente, successivo };
}

function giorniDelMese(anno: number, mese: number) {
  const giorni = new Date(Date.UTC(anno, mese + 1, 0)).getUTCDate();
  const primoGiorno = new Date(Date.UTC(anno, mese, 1)).getUTCDay();
  const offsetLunedi = (primoGiorno + 6) % 7;
  return { giorni, offsetLunedi };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function Calendario() {
  const [vista, setVista] = useState<"mese" | "lista">("mese");
  // SSR-safe: la data di oggi arriva solo dopo il mount.
  const [oggi, setOggi] = useState<{ anno: number; mese: number; giorno: number } | null>(null);
  useEffect(() => {
    const d = new Date();
    setOggi({ anno: d.getFullYear(), mese: d.getMonth(), giorno: d.getDate() });
  }, []);
  const [giornoSelezionato, setGiornoSelezionato] = useState<number | null>(null);
  const [drawerAperto, setDrawerAperto] = useState(false);
  const io = useGiocatoreCorrente();
  const admin = useIsAdmin();
  const { eventi } = useEventi();
  const { anno, mese, precedente, successivo } = useMeseNav();
  const { giorni, offsetLunedi } = giorniDelMese(anno, mese);
  const mesePrefix = `${anno}-${pad2(mese + 1)}`;

  const compleanni = compleanniEventi(anno);
  const compleanniMese = compleanni.filter((c) => c.data.startsWith(mesePrefix));
  const eventiMese = eventi.filter((e) => e.data.startsWith(mesePrefix));

  const eventiPerGiorno = new Map<number, Evento[]>();
  for (const e of [...compleanniMese, ...eventiMese]) {
    const g = Number(e.data.slice(8, 10));
    const lista = eventiPerGiorno.get(g) ?? [];
    lista.push(e);
    eventiPerGiorno.set(g, lista);
  }

  function apriGiorno(giorno: number) {
    if (!eventiPerGiorno.has(giorno)) return;
    setGiornoSelezionato(giorno);
    setDrawerAperto(true);
  }

  const eventiGiornoSelezionato = giornoSelezionato
    ? (eventiPerGiorno.get(giornoSelezionato) ?? [])
    : [];

  return (
    <>
      <PageHeader titolo="Calendario" sottotitolo={`${mesiIT[mese]} ${anno} · Stagione 2026/27`} />

      <div className="px-5 pt-4">
        <div className="flex rounded-full bg-secondary p-1">
          {(["mese", "lista"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={cn(
                "flex-1 rounded-full py-2 text-xs font-bold uppercase tracking-wide transition-colors",
                vista === v ? "bg-card shadow-card text-foreground" : "text-muted-foreground",
              )}
            >
              {v === "mese" ? "Vista mese" : "Lista eventi"}
            </button>
          ))}
        </div>
      </div>

      {vista === "mese" ? (
        <Section titolo={mesiIT[mese]!}>
          <div className="rounded-3xl bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={precedente}
                className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground active:scale-95"
                aria-label="Mese precedente"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="font-display text-xl uppercase tracking-wide">
                {mesiIT[mese]} {anno}
              </span>
              <button
                type="button"
                onClick={successivo}
                className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground active:scale-95"
                aria-label="Mese successivo"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground">
              {giorniIT.map((g, i) => (
                <span key={i}>{g}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {Array.from({ length: offsetLunedi }).map((_, i) => (
                <span key={`v${i}`} />
              ))}
              {Array.from({ length: giorni }).map((_, i) => {
                const giorno = i + 1;
                const eventiGiorno = eventiPerGiorno.get(giorno) ?? [];
                const haEventi = eventiGiorno.length > 0;
                const tipiGiorno = Array.from(new Set(eventiGiorno.map((e) => e.tipo)));
                const coloreTipo: Record<Evento["tipo"], string> = {
                  partita: "var(--accent)",
                  allenamento: "var(--training)",
                  evento: "var(--warning)",
                  compleanno: "var(--success)",
                };
                const sfondo =
                  tipiGiorno.length > 1
                    ? `linear-gradient(135deg, ${tipiGiorno
                        .map((t, idx) => {
                          const da = (idx / tipiGiorno.length) * 100;
                          const a = ((idx + 1) / tipiGiorno.length) * 100;
                          return `${coloreTipo[t]} ${da}%, ${coloreTipo[t]} ${a}%`;
                        })
                        .join(", ")})`
                    : undefined;
                const tipo = tipiGiorno.length === 1 ? tipiGiorno[0] : undefined;
                const isOggi =
                  !!oggi && oggi.anno === anno && oggi.mese === mese && oggi.giorno === giorno;
                const Cella = haEventi ? "button" : "div";
                return (
                  <Cella
                    key={giorno}
                    type={haEventi ? "button" : undefined}
                    onClick={haEventi ? () => apriGiorno(giorno) : undefined}
                    style={sfondo ? { backgroundImage: sfondo } : undefined}
                    className={cn(
                      "relative grid aspect-square place-items-center rounded-xl text-sm font-semibold",
                      tipo === "partita" && "bg-accent text-accent-foreground",
                      tipo === "allenamento" && "bg-training text-training-foreground",
                      tipo === "evento" && "bg-warning text-warning-foreground",
                      tipo === "compleanno" && "bg-success text-success-foreground",
                      !tipo && !haEventi && "text-muted-foreground",
                      !tipo && haEventi && "text-foreground",
                      haEventi && "cursor-pointer transition-transform active:scale-90",
                      isOggi && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
                    )}
                    aria-label={haEventi ? `Eventi del ${giorno}` : undefined}
                    aria-current={isOggi ? "date" : undefined}
                  >
                    <span className="relative drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                      {giorno}
                    </span>
                  </Cella>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-[11px] font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-full bg-accent" /> Partita
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-full bg-training" /> Allenamento
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-full bg-warning" /> Eventi
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-full bg-success" /> Compleanni
              </span>
            </div>
          </div>
        </Section>
      ) : null}

      {admin ? (
        <div className="px-5 pt-4">
          <Link
            to="/eventi"
            className="premi flex items-center justify-center gap-2 rounded-2xl bg-accent-grad py-3 text-sm font-bold uppercase text-accent-foreground shadow-pop"
          >
            <CalendarPlus className="h-4 w-4" /> Gestisci eventi
          </Link>
        </div>
      ) : null}

      <Section titolo="Prossimi eventi">
        <div className="space-y-3">
          {eventiMese.length > 0 ? (
            eventiMese.map((e) => {
              const link = linkPerEvento(e);
              return <EventoCard key={e.id} evento={e} {...(link ? { linkTo: link } : {})} />;
            })
          ) : (
            <p className="rounded-3xl bg-card p-4 text-center text-sm text-muted-foreground shadow-card">
              Nessun evento in {mesiIT[mese]!.toLowerCase()}
            </p>
          )}
        </div>
      </Section>

      <Section titolo="Compleanni">
        <div className="space-y-3">
          {compleanniMese.length > 0 ? (
            compleanniMese.map((c) => <EventoCard key={c.id} evento={c} />)
          ) : (
            <p className="rounded-3xl bg-card p-4 text-center text-sm text-muted-foreground shadow-card">
              Nessun compleanno in {mesiIT[mese]!.toLowerCase()}
            </p>
          )}
        </div>
      </Section>

      <Drawer open={drawerAperto} onOpenChange={setDrawerAperto}>
        <DrawerContent className="rounded-t-[24px] border-border bg-background px-4 pb-6 pt-2">
          <DrawerHeader className="relative px-0 pb-2 text-left">
            <DrawerTitle className="font-display text-2xl uppercase tracking-wide">
              {giornoSelezionato ? `${giornoSelezionato} ${mesiIT[mese]}` : "Eventi"}
            </DrawerTitle>
            <DrawerClose className="absolute right-0 top-1 grid h-8 w-8 place-items-center rounded-full bg-secondary text-foreground transition-transform active:scale-90">
              <X className="h-4 w-4" />
              <span className="sr-only">Chiudi</span>
            </DrawerClose>
          </DrawerHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto py-2">
            {eventiGiornoSelezionato.length > 0 ? (
              eventiGiornoSelezionato.map((e) => {
                const link = linkPerEvento(e);
                return <EventoCard key={e.id} evento={e} {...(link ? { linkTo: link } : {})} />;
              })
            ) : (
              <p className="rounded-3xl bg-card p-4 text-center text-sm text-muted-foreground shadow-card">
                Nessun evento in questa data
              </p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

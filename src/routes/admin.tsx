import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Download, FileText, IdCard, Image, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader, Section, StatTile } from "@/components/crapp/ui-bits";
import { useGiocatoriSquadra, nomeCompleto } from "@/lib/giocatori-squadra";
import { useProfili, scaricaFile } from "@/lib/profili";
import {
  completamento,
  csvTesseramento,
  sezioniComplete,
  statoScadenza,
  type Profilo,
  type StatoScadenza,
} from "@/lib/profili-core";
import { oggiISO } from "@/lib/palloni-core";
import { scaricaCsv } from "@/lib/scout-export";
import { useIsAdmin } from "@/lib/ruoli";
import { Reveal } from "@/components/motion/Reveal";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Dashboard amministratore — CrAPP" },
      {
        name: "description",
        content:
          "Area riservata: stato dei profili, documenti e certificati della squadra, ed export dei dati per il tesseramento CSI.",
      },
      { property: "og:title", content: "Dashboard amministratore — CrAPP" },
      {
        property: "og:description",
        content: "Stato dei profili della squadra ed export per il tesseramento CSI.",
      },
    ],
  }),
  component: Dashboard,
});

const statoClasse: Record<StatoScadenza | "presente" | "assente", string> = {
  valido: "bg-success text-success-foreground",
  presente: "bg-success text-success-foreground",
  scaduto: "bg-destructive text-destructive-foreground",
  mancante: "bg-secondary text-muted-foreground",
  assente: "bg-secondary text-muted-foreground",
};

function Riga({ etichetta, valore }: { etichetta: string; valore: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{etichetta}</span>
      <span className="truncate text-right font-medium">{valore || "—"}</span>
    </div>
  );
}

function Documento({
  icona,
  label,
  stato,
  path,
}: {
  icona: React.ReactNode;
  label: string;
  stato: StatoScadenza | "presente" | "assente";
  path: string | null;
}) {
  const [inCorso, setInCorso] = useState(false);

  async function scarica() {
    if (!path || inCorso) return;
    setInCorso(true);
    try {
      await scaricaFile(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download non riuscito");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <button
      type="button"
      onClick={scarica}
      disabled={!path || inCorso}
      className={cn(
        "premi flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase disabled:opacity-60",
        statoClasse[stato],
      )}
    >
      {inCorso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icona}
      {label}
      {path ? <Download className="h-3 w-3" /> : null}
    </button>
  );
}

function SchedaGiocatore({
  nome,
  ruolo,
  numero,
  profilo,
  oggi,
  indice,
}: {
  nome: string;
  ruolo: string;
  numero: number;
  profilo: Profilo | undefined;
  oggi: string;
  indice: number;
}) {
  const [aperta, setAperta] = useState(false);
  const perc = completamento(profilo);
  const sezioni = sezioniComplete(profilo);
  const certificato = statoScadenza(profilo?.certificatoScadenza, profilo?.certificatoPath, oggi);
  const fronte = statoScadenza(profilo?.documentoScadenza, profilo?.documentoFrontePath, oggi);
  const retro = statoScadenza(profilo?.documentoScadenza, profilo?.documentoRetroPath, oggi);

  return (
    <Reveal indice={indice} className="rounded-2xl bg-card p-4 shadow-card">
      <button
        type="button"
        onClick={() => setAperta((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary font-display text-sm tabular-nums">
          {numero}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{nome}</p>
          <p className="text-xs text-muted-foreground">
            {ruolo} · profilo {perc}%
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            aperta && "rotate-180",
          )}
        />
      </button>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-accent-grad transition-all"
          style={{ width: `${perc}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Documento
          icona={<IdCard className="h-3.5 w-3.5" />}
          label="Doc fronte"
          stato={fronte}
          path={profilo?.documentoFrontePath ?? null}
        />
        <Documento
          icona={<IdCard className="h-3.5 w-3.5" />}
          label="Doc retro"
          stato={retro}
          path={profilo?.documentoRetroPath ?? null}
        />
        <Documento
          icona={<FileText className="h-3.5 w-3.5" />}
          label="Certificato"
          stato={certificato}
          path={profilo?.certificatoPath ?? null}
        />
        <Documento
          icona={<Image className="h-3.5 w-3.5" />}
          label="Foto"
          stato={sezioni.foto ? "presente" : "assente"}
          path={profilo?.fotoPath ?? null}
        />
      </div>

      {aperta ? (
        <div className="mt-3 border-t border-border pt-3">
          <Riga etichetta="Data di nascita" valore={profilo?.dataNascita ?? null} />
          <Riga etichetta="Luogo di nascita" valore={profilo?.luogoNascita ?? null} />
          <Riga etichetta="Indirizzo" valore={profilo?.indirizzo ?? null} />
          <Riga etichetta="Telefono" valore={profilo?.telefono ?? null} />
          <Riga etichetta="Email" valore={profilo?.email ?? null} />
          <Riga
            etichetta="Documento"
            valore={
              profilo?.documentoNumero
                ? `${profilo.documentoTipo ?? ""} ${profilo.documentoNumero}`.trim()
                : null
            }
          />
          <Riga etichetta="Rilasciato da" valore={profilo?.documentoRilasciatoDa ?? null} />
          <Riga etichetta="Scadenza documento" valore={profilo?.documentoScadenza ?? null} />
          <Riga etichetta="Scadenza certificato" valore={profilo?.certificatoScadenza ?? null} />
        </div>
      ) : null}
    </Reveal>
  );
}

function Dashboard() {
  const admin = useIsAdmin();
  const { righe: squadra } = useGiocatoriSquadra();
  const { profili, isPending } = useProfili();
  const oggi = oggiISO();

  if (!admin) {
    return (
      <>
        <PageHeader titolo="Dashboard" sottotitolo="Area riservata" />
        <div className="px-5 pt-4">
          <p className="flex items-center justify-center gap-2 rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
            <Lock className="h-4 w-4 shrink-0" />
            Riservata agli amministratori della squadra.
          </p>
        </div>
      </>
    );
  }

  const attivi = squadra.filter((g) => g.attivo);
  const completi = attivi.filter((g) => completamento(profili[g.id]) === 100).length;
  const certificatiOk = attivi.filter(
    (g) =>
      statoScadenza(profili[g.id]?.certificatoScadenza, profili[g.id]?.certificatoPath, oggi) ===
      "valido",
  ).length;

  return (
    <>
      <PageHeader titolo="Dashboard" sottotitolo="Profili e tesseramento" />

      <Section titolo="Squadra">
        <div className="grid grid-cols-3 gap-2">
          <StatTile valore={attivi.length} label="Giocatori" />
          <StatTile valore={`${completi}/${attivi.length}`} label="Profili completi" />
          <StatTile
            valore={`${certificatiOk}/${attivi.length}`}
            label="Certificati validi"
            hint="non scaduti"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            scaricaCsv(`tesseramento-csi-${oggi}.csv`, csvTesseramento(attivi, profili))
          }
          className="premi mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-grad py-3 text-sm font-bold uppercase text-accent-foreground shadow-pop"
        >
          <Download className="h-4 w-4" /> Esporta CSV tesseramento
        </button>
      </Section>

      <Section titolo="Profili" indice={1}>
        {isPending ? (
          <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
            Caricamento…
          </p>
        ) : (
          <div className="space-y-3">
            {attivi.map((g, i) => (
              <SchedaGiocatore
                key={g.id}
                nome={nomeCompleto(g)}
                ruolo={g.ruolo}
                numero={g.numero}
                profilo={profili[g.id]}
                oggi={oggi}
                indice={i}
              />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

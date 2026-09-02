import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  ChevronDown,
  Download,
  FileText,
  IdCard,
  Image,
  Loader2,
  Lock,
  Unlink,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader, Section, StatTile } from "@/components/crapp/ui-bits";
import { CampiProfilo } from "@/components/crapp/ProfiloAmministrativo";
import {
  nomeCompleto,
  numeroGiaUsato,
  prossimoIdGiocatore,
  useAggiungiGiocatore,
  useGiocatoriSquadra,
  useImpostaAttivo,
  useSalvaDatiSquadra,
  useSalvaTesseramento,
  useScollegaAccount,
  validaDatiSquadra,
  type DatiSquadra,
  type DatiTesseramento,
  type GiocatoreSquadra,
} from "@/lib/giocatori-squadra";
import { scaricaFile, useProfili, useSalvaProfilo } from "@/lib/profili";
import {
  completamento,
  csvTesseramento,
  profiloVuoto,
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

const classiInput = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

/** L'unico vincolo unique lato database sulla tabella è l'email: messaggio leggibile invece
 * del codice Postgres (23505). */
function messaggioErrore(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "code" in e && (e as { code?: unknown }).code === "23505") {
    return "Email già usata da un altro giocatore.";
  }
  return e instanceof Error ? e.message : fallback;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

/**
 * Pannello di modifica dell'admin (DD-017): dati squadra, dati personali e collegamento
 * all'account. I file restano fuori: l'admin li scarica, non li carica al posto di altri.
 */
function ModificaGiocatore({ g, profilo }: { g: GiocatoreSquadra; profilo: Profilo | undefined }) {
  const { righe } = useGiocatoriSquadra();
  const salvaSquadra = useSalvaDatiSquadra();
  const salvaProfilo = useSalvaProfilo();
  const salvaTesseramento = useSalvaTesseramento();
  const scollega = useScollegaAccount();
  const impostaAttivo = useImpostaAttivo();

  const [datiSquadra, setDatiSquadra] = useState<DatiSquadra | null>(null);
  const [bozza, setBozza] = useState<Profilo | null>(null);
  const [tesseramento, setTesseramento] = useState<DatiTesseramento | null>(null);

  const tesseramentoCorrente: DatiTesseramento = tesseramento ?? {
    numeroTessera: g.numeroTessera,
    dataTessera: g.dataTessera,
  };

  const squadraCorrente: DatiSquadra = datiSquadra ?? {
    nome: g.nome,
    cognome: g.cognome,
    numero: g.numero,
    ruolo: g.ruolo,
    email: g.email,
  };
  const profiloCorrente = bozza ?? profilo ?? profiloVuoto(g.id);

  async function confermaSquadra() {
    const errore = validaDatiSquadra(squadraCorrente);
    if (errore) {
      toast.error(errore);
      return;
    }
    if (numeroGiaUsato(righe, g.id, squadraCorrente.numero)) {
      toast.warning(`Il numero ${squadraCorrente.numero} è già assegnato a un altro giocatore.`);
    }
    try {
      await salvaSquadra.mutateAsync({ giocatoreId: g.id, dati: squadraCorrente });
      setDatiSquadra(null);
      toast.success("Dati squadra aggiornati");
    } catch (e) {
      toast.error(messaggioErrore(e, "Salvataggio non riuscito"));
    }
  }

  async function confermaAttivo(nuovo: boolean) {
    const messaggio = nuovo
      ? `Riattivare ${nomeCompleto(g)}?`
      : `Disattivare ${nomeCompleto(g)}? Sparisce dalla rosa attiva ma i suoi dati (presenze, voti, badge) restano.`;
    if (!confirm(messaggio)) return;
    try {
      await impostaAttivo.mutateAsync({ giocatoreId: g.id, attivo: nuovo });
      toast.success(nuovo ? "Giocatore riattivato" : "Giocatore disattivato");
    } catch (e) {
      toast.error(messaggioErrore(e, "Operazione non riuscita"));
    }
  }

  async function confermaTesseramento() {
    try {
      await salvaTesseramento.mutateAsync({ giocatoreId: g.id, dati: tesseramentoCorrente });
      setTesseramento(null);
      toast.success("Tesseramento aggiornato");
    } catch (e) {
      toast.error(messaggioErrore(e, "Salvataggio non riuscito"));
    }
  }

  async function confermaProfilo() {
    try {
      await salvaProfilo.mutateAsync(profiloCorrente);
      setBozza(null);
      toast.success("Profilo aggiornato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Salvataggio non riuscito");
    }
  }

  async function confermaScollega() {
    if (
      !confirm(
        `Scollegare l'account di ${nomeCompleto(g)}? Potrà ricollegarsi al prossimo accesso.`,
      )
    )
      return;
    try {
      await scollega.mutateAsync(g.id);
      toast.success("Account scollegato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operazione non riuscita");
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <h3 className="font-display text-sm uppercase tracking-wide">Dati squadra</h3>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Nome">
          <input
            value={squadraCorrente.nome}
            maxLength={40}
            onChange={(e) => setDatiSquadra({ ...squadraCorrente, nome: e.target.value })}
            className={classiInput}
          />
        </Campo>
        <Campo label="Cognome">
          <input
            value={squadraCorrente.cognome}
            maxLength={40}
            onChange={(e) => setDatiSquadra({ ...squadraCorrente, cognome: e.target.value })}
            className={classiInput}
          />
        </Campo>
        <Campo label="Numero">
          <input
            type="number"
            min={1}
            value={squadraCorrente.numero}
            onChange={(e) => setDatiSquadra({ ...squadraCorrente, numero: Number(e.target.value) })}
            className={classiInput}
          />
        </Campo>
        <Campo label="Ruolo">
          <input
            value={squadraCorrente.ruolo}
            maxLength={30}
            onChange={(e) => setDatiSquadra({ ...squadraCorrente, ruolo: e.target.value })}
            className={classiInput}
          />
        </Campo>
      </div>
      <Campo label="Email (collegamento automatico al login, DD-018)">
        <input
          type="email"
          value={squadraCorrente.email ?? ""}
          placeholder="nome@esempio.com"
          onChange={(e) => setDatiSquadra({ ...squadraCorrente, email: e.target.value || null })}
          className={classiInput}
        />
      </Campo>
      <button
        type="button"
        onClick={confermaSquadra}
        disabled={!datiSquadra || salvaSquadra.isPending}
        className="premi w-full rounded-2xl bg-primary py-2.5 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
      >
        Salva dati squadra
      </button>

      <h3 className="font-display text-sm uppercase tracking-wide">Tesseramento CSI</h3>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Numero tessera">
          <input
            value={tesseramentoCorrente.numeroTessera ?? ""}
            maxLength={40}
            placeholder="Non ancora tesserato"
            onChange={(e) =>
              setTesseramento({ ...tesseramentoCorrente, numeroTessera: e.target.value || null })
            }
            className={classiInput}
          />
        </Campo>
        <Campo label="Data tessera">
          <input
            type="date"
            value={tesseramentoCorrente.dataTessera ?? ""}
            onChange={(e) =>
              setTesseramento({ ...tesseramentoCorrente, dataTessera: e.target.value || null })
            }
            className={classiInput}
          />
        </Campo>
      </div>
      <button
        type="button"
        onClick={confermaTesseramento}
        disabled={!tesseramento || salvaTesseramento.isPending}
        className="premi w-full rounded-2xl bg-primary py-2.5 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
      >
        Salva tesseramento
      </button>

      <CampiProfilo
        corrente={profiloCorrente}
        aggiorna={(patch) => setBozza({ ...profiloCorrente, ...patch })}
        sezioni={sezioniComplete(profiloCorrente)}
      />
      <button
        type="button"
        onClick={confermaProfilo}
        disabled={!bozza || salvaProfilo.isPending}
        className="premi w-full rounded-2xl bg-primary py-2.5 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
      >
        Salva dati personali
      </button>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
        <span className="min-w-0 text-muted-foreground">
          {g.authUserId ? "Account collegato" : "Nessun account collegato"}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {g.authUserId ? (
            <button
              type="button"
              onClick={confermaScollega}
              disabled={scollega.isPending}
              className="premi flex items-center gap-1.5 rounded-xl bg-destructive px-3 py-2 font-bold text-destructive-foreground disabled:opacity-50"
            >
              <Unlink className="h-3.5 w-3.5" /> Scollega
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void confermaAttivo(!g.attivo)}
            disabled={impostaAttivo.isPending}
            className={cn(
              "premi flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold disabled:opacity-50",
              g.attivo ? "bg-secondary text-foreground" : "bg-success text-success-foreground",
            )}
          >
            {g.attivo ? (
              <>
                <UserX className="h-3.5 w-3.5" /> Disattiva
              </>
            ) : (
              <>
                <UserCheck className="h-3.5 w-3.5" /> Riattiva
              </>
            )}
          </button>
        </div>
      </div>
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
  g,
  profilo,
  oggi,
  indice,
}: {
  g: GiocatoreSquadra;
  profilo: Profilo | undefined;
  oggi: string;
  indice: number;
}) {
  const [aperta, setAperta] = useState(false);
  const nome = nomeCompleto(g);
  const { ruolo, numero } = g;
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
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase",
            statoClasse[g.numeroTessera ? "presente" : "assente"],
          )}
        >
          <BadgeCheck className="h-3.5 w-3.5" />
          {g.numeroTessera ? "Tesserato" : "Da tesserare"}
        </span>
      </div>

      {aperta ? <ModificaGiocatore g={g} profilo={profilo} /> : null}
    </Reveal>
  );
}

const datiVuoti: DatiSquadra = { nome: "", cognome: "", numero: 1, ruolo: "", email: null };

/** Form per aggiungere un giocatore alla rosa (DD-017): l'id `g<N>` è calcolato in app,
 * il database non lo genera da solo. */
function AggiungiGiocatore({ righe }: { righe: GiocatoreSquadra[] }) {
  const [aperto, setAperto] = useState(false);
  const [dati, setDati] = useState<DatiSquadra>(datiVuoti);
  const aggiungi = useAggiungiGiocatore();

  async function conferma() {
    const errore = validaDatiSquadra(dati);
    if (errore) {
      toast.error(errore);
      return;
    }
    if (numeroGiaUsato(righe, "", dati.numero)) {
      toast.warning(`Il numero ${dati.numero} è già assegnato a un altro giocatore.`);
    }
    try {
      await aggiungi.mutateAsync({ id: prossimoIdGiocatore(righe), dati });
      toast.success(`${dati.nome} ${dati.cognome} aggiunto alla rosa`);
      setDati(datiVuoti);
      setAperto(false);
    } catch (e) {
      toast.error(messaggioErrore(e, "Aggiunta non riuscita"));
    }
  }

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="premi mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-sm font-bold uppercase"
      >
        <UserPlus className="h-4 w-4" /> Aggiungi giocatore
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-card p-4 shadow-card">
      <h3 className="font-display text-sm uppercase tracking-wide">Nuovo giocatore</h3>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Nome">
          <input
            value={dati.nome}
            maxLength={40}
            onChange={(e) => setDati({ ...dati, nome: e.target.value })}
            className={classiInput}
          />
        </Campo>
        <Campo label="Cognome">
          <input
            value={dati.cognome}
            maxLength={40}
            onChange={(e) => setDati({ ...dati, cognome: e.target.value })}
            className={classiInput}
          />
        </Campo>
        <Campo label="Numero">
          <input
            type="number"
            min={1}
            value={dati.numero}
            onChange={(e) => setDati({ ...dati, numero: Number(e.target.value) })}
            className={classiInput}
          />
        </Campo>
        <Campo label="Ruolo">
          <input
            value={dati.ruolo}
            maxLength={30}
            onChange={(e) => setDati({ ...dati, ruolo: e.target.value })}
            className={classiInput}
          />
        </Campo>
      </div>
      <Campo label="Email (collegamento automatico al login, opzionale)">
        <input
          type="email"
          value={dati.email ?? ""}
          placeholder="nome@esempio.com"
          onChange={(e) => setDati({ ...dati, email: e.target.value || null })}
          className={classiInput}
        />
      </Campo>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAperto(false);
            setDati(datiVuoti);
          }}
          className="premi flex-1 rounded-2xl bg-secondary py-2.5 text-xs font-bold uppercase"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={() => void conferma()}
          disabled={aggiungi.isPending}
          className="premi flex-1 rounded-2xl bg-primary py-2.5 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
        >
          Aggiungi
        </button>
      </div>
    </div>
  );
}

/** Riga compatta per riattivare un giocatore che aveva lasciato la squadra. */
function GiocatoreDisattivato({ g }: { g: GiocatoreSquadra }) {
  const impostaAttivo = useImpostaAttivo();

  async function riattiva() {
    if (!confirm(`Riattivare ${nomeCompleto(g)}?`)) return;
    try {
      await impostaAttivo.mutateAsync({ giocatoreId: g.id, attivo: true });
      toast.success("Giocatore riattivato");
    } catch (e) {
      toast.error(messaggioErrore(e, "Operazione non riuscita"));
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 shadow-card">
      <div className="min-w-0">
        <p className="truncate font-semibold leading-tight">{nomeCompleto(g)}</p>
        <p className="text-xs text-muted-foreground">
          #{g.numero} · {g.ruolo}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void riattiva()}
        disabled={impostaAttivo.isPending}
        className="premi flex shrink-0 items-center gap-1.5 rounded-xl bg-success px-3 py-2 text-xs font-bold text-success-foreground disabled:opacity-50"
      >
        <UserCheck className="h-3.5 w-3.5" /> Riattiva
      </button>
    </div>
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
  const disattivi = squadra.filter((g) => !g.attivo);
  const completi = attivi.filter((g) => completamento(profili[g.id]) === 100).length;
  const certificatiOk = attivi.filter(
    (g) =>
      statoScadenza(profili[g.id]?.certificatoScadenza, profili[g.id]?.certificatoPath, oggi) ===
      "valido",
  ).length;
  const tesserati = attivi.filter((g) => g.numeroTessera).length;

  return (
    <>
      <PageHeader titolo="Dashboard" sottotitolo="Profili e tesseramento" />

      <Section titolo="Squadra">
        <div className="grid grid-cols-2 gap-2">
          <StatTile valore={attivi.length} label="Giocatori" />
          <StatTile valore={`${completi}/${attivi.length}`} label="Profili completi" />
          <StatTile
            valore={`${certificatiOk}/${attivi.length}`}
            label="Certificati validi"
            hint="non scaduti"
          />
          <StatTile valore={`${tesserati}/${attivi.length}`} label="Tesserati" hint="CSI" />
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
        <AggiungiGiocatore righe={squadra} />
      </Section>

      <Section titolo="Profili" indice={1}>
        {isPending ? (
          <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
            Caricamento…
          </p>
        ) : (
          <div className="space-y-3">
            {attivi.map((g, i) => (
              <SchedaGiocatore key={g.id} g={g} profilo={profili[g.id]} oggi={oggi} indice={i} />
            ))}
          </div>
        )}
      </Section>

      {disattivi.length > 0 ? (
        <Section titolo="Giocatori disattivati" indice={2}>
          <div className="space-y-2">
            {disattivi.map((g) => (
              <GiocatoreDisattivato key={g.id} g={g} />
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}

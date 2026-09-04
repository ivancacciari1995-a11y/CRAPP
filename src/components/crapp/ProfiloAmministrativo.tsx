import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Eye, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SezioneTendina } from "@/components/crapp/ui-bits";
import { Reveal } from "@/components/motion/Reveal";
import {
  caricaFile,
  scaricaFile,
  useProfili,
  useSalvaProfilo,
  type SezioneFile,
} from "@/lib/profili";
import {
  completamento,
  profiloVuoto,
  sezioniComplete,
  type Profilo,
  type Sezione,
} from "@/lib/profili-core";

const TIPI_DOCUMENTO = ["Carta d'identità", "Patente", "Passaporto"];

const classiInput = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

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

function Intestazione({ titolo, completa }: { titolo: string; completa: boolean }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <h3 className="font-display text-sm uppercase tracking-wide">{titolo}</h3>
      {completa ? <Check className="h-4 w-4 text-success" /> : null}
    </div>
  );
}

function CampoFile({
  label,
  path,
  sezione,
  giocatoreId,
  onCaricato,
}: {
  label: string;
  path: string | null;
  sezione: SezioneFile;
  giocatoreId: string;
  onCaricato: (path: string) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [inCorso, setInCorso] = useState(false);

  async function scegli(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setInCorso(true);
    try {
      const nuovo = await caricaFile(giocatoreId, sezione, file, path);
      await onCaricato(nuovo);
      toast.success(`${label} caricato`);
    } catch (errore) {
      toast.error(errore instanceof Error ? errore.message : "Caricamento non riuscito");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-lg",
            path ? "bg-success text-success-foreground" : "bg-secondary text-muted-foreground",
          )}
        >
          {path ? <Check className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {path ? (
          <button
            type="button"
            onClick={() => void scaricaFile(path)}
            className="premi rounded-xl bg-secondary p-2 text-muted-foreground"
            aria-label={`Vedi ${label}`}
          >
            <Eye className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={inCorso}
          className="premi rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {inCorso ? <Loader2 className="h-4 w-4 animate-spin" /> : path ? "Sostituisci" : "Carica"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={scegli}
          className="hidden"
        />
      </span>
    </div>
  );
}

/**
 * I campi del profilo, condivisi tra il giocatore e la dashboard amministratore (DD-017).
 * Gli upload arrivano come slot: l'admin non carica file al posto di altri, quindi da lì
 * quelle righe semplicemente non compaiono.
 */
export function CampiProfilo({
  corrente,
  aggiorna,
  sezioni,
  fileDocumento,
  fileCertificato,
  fileFoto,
}: {
  corrente: Profilo;
  aggiorna: (patch: Partial<Profilo>) => void;
  sezioni: Record<Sezione, boolean>;
  fileDocumento?: React.ReactNode;
  fileCertificato?: React.ReactNode;
  fileFoto?: React.ReactNode;
}) {
  return (
    <>
      <Intestazione titolo="Dati personali" completa={sezioni.dati} />
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Data di nascita">
          <input
            type="date"
            value={corrente.dataNascita ?? ""}
            onChange={(e) => aggiorna({ dataNascita: e.target.value })}
            className={classiInput}
          />
        </Campo>
        <Campo label="Luogo di nascita">
          <input
            value={corrente.luogoNascita ?? ""}
            maxLength={80}
            onChange={(e) => aggiorna({ luogoNascita: e.target.value })}
            className={classiInput}
          />
        </Campo>
      </div>
      <Campo label="Indirizzo di residenza">
        <input
          value={corrente.indirizzo ?? ""}
          maxLength={120}
          onChange={(e) => aggiorna({ indirizzo: e.target.value })}
          className={classiInput}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Telefono">
          <input
            type="tel"
            value={corrente.telefono ?? ""}
            maxLength={20}
            onChange={(e) => aggiorna({ telefono: e.target.value })}
            className={classiInput}
          />
        </Campo>
        <Campo label="Email">
          <input
            type="email"
            value={corrente.email ?? ""}
            maxLength={120}
            onChange={(e) => aggiorna({ email: e.target.value })}
            className={classiInput}
          />
        </Campo>
      </div>

      <Intestazione titolo="Documento di identità" completa={sezioni.documento} />
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Tipo">
          <select
            value={corrente.documentoTipo ?? ""}
            onChange={(e) => aggiorna({ documentoTipo: e.target.value })}
            className={classiInput}
          >
            <option value="">—</option>
            {TIPI_DOCUMENTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Numero">
          <input
            value={corrente.documentoNumero ?? ""}
            maxLength={40}
            onChange={(e) => aggiorna({ documentoNumero: e.target.value })}
            className={classiInput}
          />
        </Campo>
      </div>
      <Campo label="Rilasciato da">
        <input
          value={corrente.documentoRilasciatoDa ?? ""}
          maxLength={80}
          onChange={(e) => aggiorna({ documentoRilasciatoDa: e.target.value })}
          className={classiInput}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Data emissione">
          <input
            type="date"
            value={corrente.documentoEmissione ?? ""}
            onChange={(e) => aggiorna({ documentoEmissione: e.target.value })}
            className={classiInput}
          />
        </Campo>
        <Campo label="Data scadenza">
          <input
            type="date"
            value={corrente.documentoScadenza ?? ""}
            onChange={(e) => aggiorna({ documentoScadenza: e.target.value })}
            className={classiInput}
          />
        </Campo>
      </div>
      {fileDocumento}

      <Intestazione titolo="Certificato medico" completa={sezioni.certificato} />
      <Campo label="Data di scadenza">
        <input
          type="date"
          value={corrente.certificatoScadenza ?? ""}
          onChange={(e) => aggiorna({ certificatoScadenza: e.target.value })}
          className={classiInput}
        />
      </Campo>
      {fileCertificato}
      {fileFoto}
    </>
  );
}

/**
 * Dati amministrativi del giocatore: quello che la dashboard amministratore poi legge.
 * Ogni giocatore scrive solo la propria riga — è la RLS a garantirlo, non questo componente.
 */
export function ProfiloAmministrativo({
  giocatoreId,
  indice = 0,
}: {
  giocatoreId: string;
  indice?: number;
}) {
  const { profili } = useProfili();
  const salva = useSalvaProfilo();
  const [bozza, setBozza] = useState<Profilo | null>(null);

  const salvato = profili[giocatoreId];
  const corrente = bozza ?? salvato ?? profiloVuoto(giocatoreId);
  const sporco = bozza !== null;
  const perc = completamento(corrente);
  const sezioni = sezioniComplete(corrente);

  function aggiorna(patch: Partial<Profilo>) {
    setBozza({ ...corrente, ...patch });
  }

  async function scrivi(profilo: Profilo) {
    await salva.mutateAsync(profilo);
    setBozza(null);
  }

  async function salvaBozza() {
    try {
      await scrivi(corrente);
      toast.success("Profilo aggiornato");
    } catch (errore) {
      toast.error(errore instanceof Error ? errore.message : "Salvataggio non riuscito");
    }
  }

  // Un file caricato va persistito subito, insieme a quello che si stava scrivendo.
  const caricato = (campo: keyof Profilo) => async (path: string) =>
    scrivi({ ...corrente, [campo]: path });

  return (
    <SezioneTendina
      titolo="Dati per il tesseramento"
      indice={indice}
      azione={<span className="text-xs font-bold tabular-nums text-muted-foreground">{perc}%</span>}
    >
      <div className="space-y-3 rounded-3xl bg-card p-4 shadow-card">
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-accent-grad transition-all"
            style={{ width: `${perc}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Servono agli amministratori per il tesseramento CSI. Li vedi solo tu e loro.
        </p>

        <CampiProfilo
          corrente={corrente}
          aggiorna={aggiorna}
          sezioni={sezioni}
          fileDocumento={
            <div className="divide-y divide-border">
              <CampoFile
                label="Foto fronte"
                path={corrente.documentoFrontePath}
                sezione="documento-fronte"
                giocatoreId={giocatoreId}
                onCaricato={caricato("documentoFrontePath")}
              />
              <CampoFile
                label="Foto retro"
                path={corrente.documentoRetroPath}
                sezione="documento-retro"
                giocatoreId={giocatoreId}
                onCaricato={caricato("documentoRetroPath")}
              />
            </div>
          }
          fileCertificato={
            <CampoFile
              label="Certificato medico"
              path={corrente.certificatoPath}
              sezione="certificato"
              giocatoreId={giocatoreId}
              onCaricato={caricato("certificatoPath")}
            />
          }
          fileFoto={
            <>
              <Intestazione titolo="Foto tessera" completa={sezioni.foto} />
              <CampoFile
                label="Foto tessera"
                path={corrente.fotoPath}
                sezione="foto"
                giocatoreId={giocatoreId}
                onCaricato={caricato("fotoPath")}
              />
            </>
          }
        />

        <button
          type="button"
          onClick={salvaBozza}
          disabled={!sporco || salva.isPending}
          className="premi flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-grad py-3 text-sm font-bold uppercase text-accent-foreground shadow-pop disabled:opacity-50"
        >
          {salva.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {sporco ? "Salva" : "Salvato"}
        </button>
      </div>
    </SezioneTendina>
  );
}

/**
 * Widget di Home: sparisce da solo quando il profilo è completo
 * (docs/modules/profilo-giocatore.md § Home).
 */
export function CompletaProfilo({
  giocatoreId,
  indice = 0,
}: {
  giocatoreId: string;
  indice?: number;
}) {
  const { profili, isPending } = useProfili();
  const perc = completamento(profili[giocatoreId]);
  if (isPending || perc === 100) return null;

  return (
    <Reveal indice={indice} className="px-5 pt-4">
      <Link to="/profilo" className="premi block rounded-3xl bg-card p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-sm uppercase tracking-wide">
            Completa il tuo profilo
          </span>
          <span className="text-xs font-bold tabular-nums text-muted-foreground">{perc}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-accent-grad transition-all"
            style={{ width: `${perc}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Documento, certificato medico e foto tessera servono per il tesseramento CSI.
        </p>
      </Link>
    </Reveal>
  );
}

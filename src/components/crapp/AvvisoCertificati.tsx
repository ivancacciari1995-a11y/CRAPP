import { AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useProfili } from "@/lib/profili";
import {
  avvisiCertificatiUtente,
  formatDataBreve,
  testoScadenza,
  type AvvisoCertificato,
} from "@/lib/profili-core";
import { useGiocatoriSquadra } from "@/lib/giocatori-squadra";
import { oggiISO } from "@/lib/palloni-core";
import { useIsAdmin, useRuoliPronti } from "@/lib/ruoli";
import { useGiocatoreBase } from "@/lib/user-store";

function Card({
  colore,
  titolo,
  righe,
  cliccabile,
}: {
  colore: "warning" | "primary";
  titolo: string;
  righe: string[];
  cliccabile?: boolean;
}) {
  const classi = `mx-5 mt-4 block rounded-3xl p-4 shadow-pop ${
    colore === "warning"
      ? "bg-warning text-warning-foreground"
      : "bg-primary text-primary-foreground"
  } ${cliccabile ? "premi" : ""}`;
  const contenuto = (
    <>
      <p className="flex items-center gap-2 font-display text-lg uppercase leading-none">
        <AlertCircle className="h-5 w-5" /> {titolo}
      </p>
      {righe.map((r) => (
        <p key={r} className="mt-2 text-xs leading-snug opacity-90">
          {r}
        </p>
      ))}
    </>
  );
  return cliccabile ? (
    <Link to="/profilo" search={{ tab: "documenti" }} className={classi}>
      {contenuto}
    </Link>
  ) : (
    <div className={classi}>{contenuto}</div>
  );
}

/**
 * Avviso certificati in scadenza/scaduti (DD-035, DD-041): calcolato al volo, niente push.
 * Il giocatore lo vede da 30 giorni prima della scadenza, lo staff da 7.
 */
export function AvvisoCertificati() {
  const admin = useIsAdmin();
  const ruoliPronti = useRuoliPronti();
  const base = useGiocatoreBase();
  const { righe: rosa } = useGiocatoriSquadra();
  const { profili, isPending } = useProfili();

  if (!ruoliPronti || isPending) return null;

  const oggi = oggiISO();

  // Admin che è anche giocatore: vede il proprio avviso a 30 giorni e quello dello staff (DD-041).
  const { personale, staff } = avvisiCertificatiUtente(rosa, profili, oggi, { admin, base });
  const cardPersonale = personale ? (
    personale.giorni < 0 ? (
      <Card
        colore="primary"
        titolo="Certificato scaduto"
        cliccabile
        righe={[
          `Il tuo certificato medico è scaduto il ${formatDataBreve(personale.scadenza)}: caricane uno nuovo`,
        ]}
      />
    ) : (
      <Card
        colore="warning"
        titolo="Certificato in scadenza"
        cliccabile
        righe={[`Il tuo certificato medico ${testoScadenza(personale.giorni)}`]}
      />
    )
  ) : null;

  if (!staff) return cardPersonale;
  const { scaduti, inScadenza } = staff;
  return (
    <>
      {cardPersonale}
      {scaduti.length > 0 ? (
        <Card
          colore="primary"
          titolo="Certificati scaduti"
          righe={scaduti.map((a) => rigaStaff(a, `scaduto il ${formatDataBreve(a.scadenza)}`))}
        />
      ) : null}
      {inScadenza.length > 0 ? (
        <Card
          colore="warning"
          titolo="Certificati in scadenza"
          righe={inScadenza.map((a) => rigaStaff(a, testoScadenza(a.giorni)))}
        />
      ) : null}
    </>
  );
}

function rigaStaff(a: AvvisoCertificato, dettaglio: string): string {
  return `${a.nome} ${a.cognome} — ${dettaglio}`;
}

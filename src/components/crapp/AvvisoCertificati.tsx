import { CalendarClock, FileClock, FileX } from "lucide-react";
import { Avviso, type RigaAvviso } from "@/components/crapp/Avviso";
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

/**
 * Avviso certificati mancanti/scaduti/in scadenza (DD-035, DD-041, DD-046): calcolato al volo, niente push.
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
  const { personale, personaleMancante, staff } = avvisiCertificatiUtente(rosa, profili, oggi, {
    admin,
    base,
  });
  const cardPersonale = personaleMancante ? (
    <Avviso
      tono="critico"
      icona={FileX}
      titolo="Certificato mancante"
      cliccabile
      testi={["Non hai ancora caricato il certificato medico: caricalo nei documenti"]}
    />
  ) : personale ? (
    personale.giorni < 0 ? (
      <Avviso
        tono="scaduto"
        icona={FileClock}
        titolo="Certificato scaduto"
        cliccabile
        testi={[
          `Il tuo certificato medico è scaduto il ${formatDataBreve(personale.scadenza)}: caricane uno nuovo`,
        ]}
      />
    ) : (
      <Avviso
        tono="attenzione"
        icona={CalendarClock}
        titolo="Certificato in scadenza"
        cliccabile
        testi={[`Il tuo certificato medico ${testoScadenza(personale.giorni)}`]}
      />
    )
  ) : null;

  if (!staff) return cardPersonale;
  const { scaduti, inScadenza, mancanti } = staff;
  return (
    <>
      {cardPersonale}
      {mancanti.length > 0 ? (
        <Avviso
          tono="critico"
          icona={FileX}
          titolo="Certificati mancanti"
          elenco={mancanti.map((m) => ({ chi: `${m.nome} ${m.cognome}`, cosa: "non caricato" }))}
        />
      ) : null}
      {scaduti.length > 0 ? (
        <Avviso
          tono="scaduto"
          icona={FileClock}
          titolo="Certificati scaduti"
          elenco={scaduti.map((a) => rigaStaff(a, `scaduto il ${formatDataBreve(a.scadenza)}`))}
        />
      ) : null}
      {inScadenza.length > 0 ? (
        <Avviso
          tono="attenzione"
          icona={CalendarClock}
          titolo="Certificati in scadenza"
          elenco={inScadenza.map((a) => rigaStaff(a, testoScadenza(a.giorni)))}
        />
      ) : null}
    </>
  );
}

function rigaStaff(a: AvvisoCertificato, dettaglio: string): RigaAvviso {
  return { chi: `${a.nome} ${a.cognome}`, cosa: dettaglio };
}

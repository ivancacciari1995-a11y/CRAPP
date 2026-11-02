/**
 * Data e ora (fuso Europe/Rome) di un istante a `ore` ore da adesso, nel formato di `eventi_app`
 * (`data` AAAA-MM-GG, `ora` HH:MM). Serve ai test del voto MVP, che dipende dall'orario di inizio.
 */
export function romaTra(ore: number): { data: string; ora: string } {
  const p: Record<string, string> = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(Date.now() + ore * 3_600_000))
      .map((x) => [x.type, x.value]),
  );
  return { data: `${p["year"]}-${p["month"]}-${p["day"]}`, ora: `${p["hour"]}:${p["minute"]}` };
}

/**
 * Una data con ora vuota vale mezzanotte. Ritorna il giorno la cui mezzanotte cade tra 2 e 26 ore
 * fa (il voto è aperto): oggi se sono passate almeno 2 ore dalla mezzanotte, altrimenti ieri.
 */
export function giornoSenzaOraAperto(): string {
  const adesso = romaTra(0);
  return Number(adesso.ora.slice(0, 2)) >= 2 ? adesso.data : romaTra(-24).data;
}

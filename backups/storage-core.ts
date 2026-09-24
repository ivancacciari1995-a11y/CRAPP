/** Logica pura del backup storage, separata dalla rete per poterla testare. */

/** Righe `CHIAVE=valore` di un file `.env`; toglie le virgolette solo se aprono e chiudono. */
export function leggiEnv(testo: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const riga of testo.split("\n")) {
    const match = /^([\w.]+)=(.*)$/.exec(riga.trim());
    if (!match) continue;
    const [, chiave, grezzo] = match as unknown as [string, string, string];
    const tra = /^(["'])(.*)\1$/.exec(grezzo);
    env[chiave] = tra ? tra[2]! : grezzo;
  }
  return env;
}

export type Voce = { name: string; id: string | null };

/** Tutti i percorsi dei file sotto `prefisso`; Supabase segnala le cartelle con `id: null`. */
export async function elencaFile(
  lista: (prefisso: string) => Promise<Voce[]>,
  prefisso = "",
): Promise<string[]> {
  const file: string[] = [];
  for (const voce of await lista(prefisso)) {
    const percorso = prefisso ? `${prefisso}/${voce.name}` : voce.name;
    if (voce.id === null) file.push(...(await elencaFile(lista, percorso)));
    else file.push(percorso);
  }
  return file;
}

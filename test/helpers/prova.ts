/** Mini-harness condiviso: nessuna dipendenza, solo conteggio e uscita non-zero. */

const falliti: string[] = [];
let eseguiti = 0;
let saltati = 0;

export async function prova(nome: string, fn: () => Promise<void> | void) {
  eseguiti += 1;
  try {
    await fn();
    console.log(`  ✓ ${nome}`);
  } catch (errore) {
    falliti.push(nome);
    console.error(`  ✗ ${nome}\n      ${(errore as Error).message.split("\n")[0]}`);
  }
}

export function salta(nome: string, motivo: string) {
  saltati += 1;
  console.log(`  · ${nome} (saltato: ${motivo})`);
}

/** Da chiamare a fine file: stampa il riepilogo e imposta il codice di uscita. */
export function riepilogo(gruppo: string) {
  const passati = eseguiti - falliti.length;
  console.log(
    `${gruppo}: ${passati}/${eseguiti} ok${saltati ? `, ${saltati} saltati` : ""}${
      falliti.length ? `, falliti: ${falliti.join(", ")}` : ""
    }`,
  );
  if (falliti.length) process.exit(1);
}

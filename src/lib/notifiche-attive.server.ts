/** Id giocatore distinti tra le righe di `push_subscriptions` (una riga per dispositivo). */
export function idsConNotificheAttive(righe: Array<{ giocatore_id: string }>): string[] {
  return [...new Set(righe.map((r) => r.giocatore_id))];
}

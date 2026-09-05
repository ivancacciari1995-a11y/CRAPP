/**
 * Parametri di molla condivisi, tarati sui valori che Apple usa in
 * "Designing Fluid Interfaces": damping (rimbalzo) e response (durata) invece
 * di massa/rigidità/smorzamento.
 *
 * L'API `bounce` + `duration` di `motion` mappa esattamente su quella coppia:
 * `bounce: 0` è criticamente smorzata (nessun sorpasso), `bounce: 0.2` è la
 * `damping 0.8` di Apple.
 *
 * Regola: `ui` ovunque; `slancio` SOLO dopo un gesto che portava già inerzia
 * (un lancio, un trascinamento rilasciato). Un menu che compare da fermo non
 * deve rimbalzare.
 */
export const molla = {
  /** Default: sposta/riposiziona. damping 1.0, response 0.4. */
  ui: { type: "spring", bounce: 0, duration: 0.4 },
  /** Dopo un gesto con inerzia. damping ~0.8, response 0.4. */
  slancio: { type: "spring", bounce: 0.2, duration: 0.4 },
  /** Fogli e drawer. damping ~0.8, response 0.3. */
  foglio: { type: "spring", bounce: 0.2, duration: 0.3 },
} as const;

/**
 * Proietta dove si fermerebbe un oggetto lanciato a `velocita` px/s, con la
 * stessa decelerazione esponenziale dello scroll iOS. Serve a scegliere il
 * punto di arrivo a partire da dove il gesto *stava andando*, non da dove il
 * dito si è staccato.
 */
export function proietta(velocita: number, decelerazione = 0.998) {
  return ((velocita / 1000) * decelerazione) / (1 - decelerazione);
}

import { useState } from "react";

/** Etichette condivise tra `/calendario` (sola lettura) ed `/eventi` (griglia di gestione). */
export const giorniIT = ["L", "M", "M", "G", "V", "S", "D"];

export const mesiIT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
] as const;

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Numero di giorni nel mese (0-indicizzato) e offset del primo giorno rispetto a lunedì. */
export function giorniDelMese(anno: number, mese: number) {
  const giorni = new Date(Date.UTC(anno, mese + 1, 0)).getUTCDate();
  const primoGiorno = new Date(Date.UTC(anno, mese, 1)).getUTCDay();
  const offsetLunedi = (primoGiorno + 6) % 7;
  return { giorni, offsetLunedi };
}

/** Stato di navigazione mese per mese, condiviso dalle griglie calendario. */
export function useMeseNav(initial?: { anno: number; mese: number }) {
  const oggi = new Date();
  const [anno, setAnno] = useState(initial?.anno ?? oggi.getFullYear());
  const [mese, setMese] = useState(initial?.mese ?? oggi.getMonth());
  // Serve a far entrare e uscire la griglia dallo stesso lato del gesto:
  // se un mese esce a sinistra, il precedente deve rientrare da sinistra.
  const [direzione, setDirezione] = useState(0);

  const precedente = () => {
    setDirezione(-1);
    if (mese === 0) {
      setMese(11);
      setAnno((a) => a - 1);
    } else {
      setMese((m) => m - 1);
    }
  };

  const successivo = () => {
    setDirezione(1);
    if (mese === 11) {
      setMese(0);
      setAnno((a) => a + 1);
    } else {
      setMese((m) => m + 1);
    }
  };

  return { anno, mese, direzione, precedente, successivo };
}

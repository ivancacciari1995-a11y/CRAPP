import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Percentuale intera di `parte` su `totale`; 0 se il totale è 0. */
export function percentuale(parte: number, totale: number): number {
  return totale ? Math.round((parte / totale) * 100) : 0;
}

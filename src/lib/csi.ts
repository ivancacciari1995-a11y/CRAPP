import { useQuery } from "@tanstack/react-query";
import type { DatiCsi } from "./csi-core";

export const CSI_KEY = ["csi"] as const;

/**
 * Classifica e risultati ufficiali CSI. Il server tiene una cache di 6 ore:
 * qui basta una lettura per sessione.
 */
export function useCsi() {
  return useQuery<DatiCsi>({
    queryKey: CSI_KEY,
    queryFn: async () => {
      const res = await fetch("/api/public/csi");
      if (!res.ok) throw new Error("CSI non disponibile");
      return res.json();
    },
    staleTime: 6 * 60 * 60_000,
    retry: 1,
  });
}

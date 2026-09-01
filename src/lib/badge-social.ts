import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HandHeart, Handshake, Laugh, Scale, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type CategoriaSocial = {
  id: string;
  nome: string;
  descrizione: string;
  emoji: string;
  icon: LucideIcon;
};

/** Categorie votate dai compagni a fine partita: un voto a testa per categoria. */
export const categorieSocial: CategoriaSocial[] = [
  {
    id: "affidabile",
    nome: "Compagno affidabile",
    descrizione: "Sempre presente, sempre sul pezzo",
    emoji: "🛡️",
    icon: Handshake,
  },
  {
    id: "spirito",
    nome: "Miglior spirito di squadra",
    descrizione: "Carica il gruppo dal primo all'ultimo punto",
    emoji: "📣",
    icon: Users,
  },
  {
    id: "fairplay",
    nome: "Fair play",
    descrizione: "Rispetto per compagni, avversari e arbitro",
    emoji: "🤝",
    icon: Scale,
  },
  {
    id: "meme",
    nome: "Meme della partita",
    descrizione: "La scena che rivedremo per tutta la stagione",
    emoji: "😂",
    icon: Laugh,
  },
  {
    id: "cuore",
    nome: "Cuore del gruppo",
    descrizione: "Chi tiene unita la squadra anche fuori dal campo",
    emoji: "❤️",
    icon: HandHeart,
  },
];

export type VotoSocial = {
  match_id: string;
  categoria: string;
  votante_id: string;
  votato_id: string;
  votato_nome: string;
};

const CHIAVE = ["badge-social-voti"] as const;

/** Tutti i voti social (poche righe): nessun polling, cache lunga. */
export function useVotiSocial() {
  return useQuery({
    queryKey: CHIAVE,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<VotoSocial[]> => {
      const { data, error } = await supabase
        .from("badge_social_voti")
        .select("match_id, categoria, votante_id, votato_id, votato_nome");
      if (error) throw error;
      return (data ?? []) as VotoSocial[];
    },
  });
}

export function useVotaSocial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (voto: VotoSocial) => {
      const { error } = await supabase
        .from("badge_social_voti")
        .upsert(voto, { onConflict: "match_id,categoria,votante_id" });
      if (error) throw error;
      return voto;
    },
    // Aggiornamento locale della cache: zero riletture.
    onSuccess: (voto) => {
      qc.setQueryData<VotoSocial[]>(CHIAVE, (prec) => {
        const altri = (prec ?? []).filter(
          (v) =>
            !(
              v.match_id === voto.match_id &&
              v.categoria === voto.categoria &&
              v.votante_id === voto.votante_id
            ),
        );
        return [...altri, voto];
      });
    },
  });
}

export type ConteggioSocial = { id: string; nome: string; voti: number };

export function conteggioCategoria(
  voti: VotoSocial[],
  matchId: string,
  categoria: string,
): ConteggioSocial[] {
  const map = new Map<string, ConteggioSocial>();
  for (const v of voti) {
    if (v.match_id !== matchId || v.categoria !== categoria) continue;
    const cur = map.get(v.votato_id) ?? { id: v.votato_id, nome: v.votato_nome, voti: 0 };
    cur.voti += 1;
    map.set(v.votato_id, cur);
  }
  return [...map.values()].sort((a, b) => b.voti - a.voti || a.nome.localeCompare(b.nome));
}

/** Vincitore di una categoria: serve un vantaggio netto, altrimenti parità. */
export function vincitoreCategoria(
  voti: VotoSocial[],
  matchId: string,
  categoria: string,
): ConteggioSocial | null {
  const c = conteggioCategoria(voti, matchId, categoria);
  if (c.length === 0) return null;
  if (c.length > 1 && c[1]!.voti === c[0]!.voti) return null;
  return c[0]!;
}

export function mioVotoSocial(
  voti: VotoSocial[],
  matchId: string,
  categoria: string,
  votanteId: string,
) {
  return (
    voti.find(
      (v) => v.match_id === matchId && v.categoria === categoria && v.votante_id === votanteId,
    ) ?? null
  );
}

/** Badge social vinti da un giocatore in tutte le partite: categoria -> numero. */
export function badgeSocialVinti(voti: VotoSocial[], giocatoreId: string) {
  const matchIds = [...new Set(voti.map((v) => v.match_id))];
  const out: Record<string, number> = {};
  for (const m of matchIds) {
    for (const cat of categorieSocial) {
      const v = vincitoreCategoria(voti, m, cat.id);
      if (v?.id === giocatoreId) out[cat.id] = (out[cat.id] ?? 0) + 1;
    }
  }
  return out;
}

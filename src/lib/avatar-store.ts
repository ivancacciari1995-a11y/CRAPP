import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatar-giocatori";
const NOME_FILE = "avatar.jpg";

function percorso(id: string) {
  return `${id}/${NOME_FILE}`;
}

/** URL pubblico e stabile: il bucket è pubblico, nessuna richiesta di rete. */
export function urlAvatar(id: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(percorso(id)).data.publicUrl;
}

const chiaveEsiste = (id: string) => ["avatar-esiste", id] as const;

/** Solo per il proprio profilo: sapere se mostrare "rimuovi immagine". */
export function useAvatarEsiste(id: string | undefined) {
  return useQuery({
    queryKey: chiaveEsiste(id ?? ""),
    enabled: !!id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).list(id!, { search: NOME_FILE });
      if (error) throw error;
      return (data ?? []).some((f) => f.name === NOME_FILE);
    },
  });
}

/**
 * Dopo un caricamento o una rimozione lo stato è noto: si scrive in cache invece di
 * rileggere l'elenco del bucket (una richiesta in meno per ogni cambio foto).
 */
export function useImpostaAvatarEsiste() {
  const qc = useQueryClient();
  return (id: string, esiste: boolean) => qc.setQueryData(chiaveEsiste(id), esiste);
}

/** Ridimensiona e comprime l'immagine scelta in un quadrato JPEG. */
function fileToBlob(file: File, size = 256): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lettura file fallita"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Immagine non valida"));
      img.onload = () => {
        const lato = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas non disponibile"));
        ctx.drawImage(
          img,
          (img.width - lato) / 2,
          (img.height - lato) / 2,
          lato,
          lato,
          0,
          0,
          size,
          size,
        );
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Conversione fallita"))),
          "image/jpeg",
          0.82,
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Ridimensiona, comprime e carica la foto profilo: sovrascrive quella precedente. */
export async function caricaAvatar(id: string, file: File) {
  const blob = await fileToBlob(file);
  const { error } = await supabase.storage.from(BUCKET).upload(percorso(id), blob, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "0",
  });
  if (error) throw error;
}

export async function rimuoviAvatar(id: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([percorso(id)]);
  if (error) throw error;
}

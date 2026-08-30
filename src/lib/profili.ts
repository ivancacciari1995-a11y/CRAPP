import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseNuoveTabelle } from "@/integrations/supabase/client-nuove-tabelle";
import {
  aRigaProfilo,
  COLONNE_PROFILO,
  daRigaProfilo,
  type Profilo,
  type RigaProfilo,
} from "./profili-core";

export const PROFILI_KEY = ["profili-giocatore"] as const;
export const BUCKET = "profili-giocatore";

async function fetchProfili(): Promise<Record<string, Profilo>> {
  const { data, error } = await supabaseNuoveTabelle
    .from("profili_giocatore")
    .select(COLONNE_PROFILO);
  if (error) throw error;
  const mappa: Record<string, Profilo> = {};
  for (const r of (data ?? []) as RigaProfilo[]) mappa[r.giocatore_id] = daRigaProfilo(r);
  return mappa;
}

/**
 * Profili visibili all'utente corrente: le policy RLS decidono quanti sono — il proprio
 * per un giocatore, tutti per un admin. Una lettura per sessione.
 */
export function useProfili() {
  const query = useQuery({ queryKey: PROFILI_KEY, queryFn: fetchProfili, staleTime: 30 * 60_000 });
  return { ...query, profili: query.data ?? {} };
}

/**
 * I documenti stanno in un bucket privato e non hanno URL permanenti (DD-016 regola 4):
 * ogni download passa da una signed URL che scade in un minuto.
 */
export async function urlFirmato(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function scaricaFile(path: string): Promise<void> {
  const url = await urlFirmato(path);
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Salva il profilo del giocatore. Le policy RLS lasciano scrivere solo la propria riga:
 * il vincolo vive nel database, qui non serve ricontrollarlo.
 */
export function useSalvaProfilo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profilo: Profilo) => {
      const { error } = await supabaseNuoveTabelle
        .from("profili_giocatore")
        .upsert(aRigaProfilo(profilo), { onConflict: "giocatore_id" });
      if (error) throw error;
      return profilo;
    },
    // Scrittura unica e cache aggiornata a mano, senza rilettura.
    onSuccess: (profilo) => {
      queryClient.setQueryData<Record<string, Profilo>>(PROFILI_KEY, (prec) => ({
        ...(prec ?? {}),
        [profilo.giocatoreId]: profilo,
      }));
    },
  });
}

export type SezioneFile = "documento-fronte" | "documento-retro" | "certificato" | "foto";

const MAX_BYTE = 8 * 1024 * 1024;
const TIPI_AMMESSI = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function estensione(nome: string): string {
  const punto = nome.lastIndexOf(".");
  const est = punto > 0 ? nome.slice(punto + 1).toLowerCase() : "";
  return /^[a-z0-9]{1,5}$/.test(est) ? est : "bin";
}

/**
 * Carica un file nella cartella del giocatore e restituisce il path da salvare sul profilo.
 * Il controllo su tipo e dimensione sta qui perché è il confine con un file scelto
 * dall'utente; le policy dello Storage impediscono comunque di scrivere fuori dalla
 * propria cartella.
 */
export async function caricaFile(
  giocatoreId: string,
  sezione: SezioneFile,
  file: File,
  pathPrecedente?: string | null,
): Promise<string> {
  if (!TIPI_AMMESSI.includes(file.type)) {
    throw new Error("Formato non ammesso: usa JPG, PNG, WEBP o PDF.");
  }
  if (file.size > MAX_BYTE) throw new Error("File troppo grande: massimo 8 MB.");

  const path = `${giocatoreId}/${sezione}.${estensione(file.name)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  // Cambiando estensione il vecchio file resterebbe orfano nel bucket.
  if (pathPrecedente && pathPrecedente !== path) {
    await supabase.storage.from(BUCKET).remove([pathPrecedente]);
  }
  return path;
}

export async function rimuoviFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

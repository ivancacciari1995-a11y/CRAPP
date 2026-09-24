// Scarica tutti i file dei bucket Supabase Storage per il backup di disaster recovery.
// Uso: node backups/download-storage.mjs [cartella-output]
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { elencaFile, leggiEnv } from "./storage-core.ts";

const env = leggiEnv(await readFile(new URL("../.env", import.meta.url), "utf8"));
for (const [chiave, valore] of Object.entries(env)) process.env[chiave] ??= valore;

const BUCKETS = ["avatar-giocatori", "profili-giocatore"];
const OUT_DIR = process.argv[2] ?? new URL("./storage/", import.meta.url).pathname;

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const elencaCartella = (bucket) => async (prefisso) => {
  const { data, error } = await supabase.storage.from(bucket).list(prefisso, { limit: 1000 });
  if (error) throw error;
  return data;
};

const falliti = [];

for (const bucket of BUCKETS) {
  console.log(`Bucket: ${bucket}`);
  const files = await elencaFile(elencaCartella(bucket));
  console.log(`  ${files.length} file trovati`);
  for (const path of files) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
      console.error(`  ERRORE ${path}:`, error.message);
      falliti.push(`${bucket}/${path}`);
      continue;
    }
    const destPath = join(OUT_DIR, bucket, path);
    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, Buffer.from(await data.arrayBuffer()));
    console.log(`  scaricato: ${bucket}/${path}`);
  }
}
if (falliti.length) {
  console.error(`${falliti.length} file non scaricati: il backup storage è incompleto.`);
  process.exit(1);
}
console.log("Fatto.");

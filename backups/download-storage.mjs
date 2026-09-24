// Scarica tutti i file dei bucket Supabase Storage per il backup di disaster recovery.
// Uso: node backups/download-storage.mjs [cartella-output]
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

for (const line of (await readFile(new URL("../.env", import.meta.url), "utf8")).split("\n")) {
  const match = /^([\w.]+)=(.*)$/.exec(line.trim());
  if (match) process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
}

const BUCKETS = ["avatar-giocatori", "profili-giocatore"];
const OUT_DIR = process.argv[2] ?? new URL("./storage/", import.meta.url).pathname;

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listAll(bucket, prefix = "") {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  let files = [];
  for (const entry of data) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      // è una "cartella" (nessun id): ricorri
      files = files.concat(await listAll(bucket, path));
    } else {
      files.push(path);
    }
  }
  return files;
}

for (const bucket of BUCKETS) {
  console.log(`Bucket: ${bucket}`);
  const files = await listAll(bucket);
  console.log(`  ${files.length} file trovati`);
  for (const path of files) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
      console.error(`  ERRORE ${path}:`, error.message);
      continue;
    }
    const destPath = join(OUT_DIR, bucket, path);
    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, Buffer.from(await data.arrayBuffer()));
    console.log(`  scaricato: ${bucket}/${path}`);
  }
}
console.log("Fatto.");

import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Avvia il server di sviluppo per i test che parlano HTTP.
 * Con BASE_URL impostata usa un server già attivo e non ne avvia uno nuovo.
 */

export type ServerTest = { baseUrl: string; stop: () => void };

/**
 * `.env` contiene solo le variabili `VITE_*`, ma le route server leggono i nomi
 * senza prefisso (vedi docs/modules/collegamento-csi.md e client.server.ts):
 * qui li deriviamo, così i test girano senza configurazione aggiuntiva.
 */
export function envDaFile(): Record<string, string> {
  let testo = "";
  try {
    testo = readFileSync(new URL("../../.env", import.meta.url), "utf8");
  } catch {
    return {};
  }
  const env: Record<string, string> = {};
  for (const riga of testo.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(riga);
    if (m?.[1]) env[m[1]] = (m[2] ?? "").trim().replace(/^["']|["']$/g, "");
  }
  if (!env["SUPABASE_URL"] && env["VITE_SUPABASE_URL"])
    env["SUPABASE_URL"] = env["VITE_SUPABASE_URL"];
  if (!env["SUPABASE_PUBLISHABLE_KEY"] && env["VITE_SUPABASE_PUBLISHABLE_KEY"]) {
    env["SUPABASE_PUBLISHABLE_KEY"] = env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  }
  return env;
}

export function haSupabase(): boolean {
  const env = { ...envDaFile(), ...process.env };
  return Boolean(env["SUPABASE_URL"] && env["SUPABASE_SERVICE_ROLE_KEY"]);
}

export async function avviaServer(timeoutMs = 120_000): Promise<ServerTest> {
  const esistente = process.env["BASE_URL"];
  if (esistente) return { baseUrl: esistente.replace(/\/$/, ""), stop: () => {} };

  const processo: ChildProcess = spawn("npm", ["run", "dev"], {
    cwd: new URL("../..", import.meta.url).pathname,
    env: { ...envDaFile(), ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
    // Gruppo di processi dedicato: npm avvia vite come figlio e un SIGTERM al
    // solo npm lascerebbe il server orfano ad occupare la porta.
    detached: true,
  });

  const stop = () => {
    if (processo.killed || processo.pid === undefined) return;
    try {
      process.kill(-processo.pid, "SIGTERM");
    } catch {
      processo.kill("SIGTERM");
    }
  };

  const baseUrl = await new Promise<string>((resolve, reject) => {
    const scadenza = setTimeout(() => {
      stop();
      reject(new Error(`Il server non è partito entro ${timeoutMs / 1000}s`));
    }, timeoutMs);

    let uscita = "";
    const cerca = (chunk: Buffer) => {
      uscita += chunk.toString();
      const url = /http:\/\/localhost:\d+/.exec(uscita)?.[0];
      if (url) {
        clearTimeout(scadenza);
        resolve(url);
      }
    };
    processo.stdout?.on("data", cerca);
    processo.stderr?.on("data", cerca);
    processo.on("exit", (code) => {
      clearTimeout(scadenza);
      reject(new Error(`Il server è uscito con codice ${code}:\n${uscita}`));
    });
  });

  await attendiPronto(baseUrl);
  return { baseUrl, stop };
}

/** Il server annuncia l'URL prima di saper rispondere: attende la prima risposta. */
async function attendiPronto(baseUrl: string, tentativi = 60) {
  for (let i = 0; i < tentativi; i += 1) {
    try {
      const res = await fetch(baseUrl, { signal: AbortSignal.timeout(5_000) });
      if (res.status < 500) return;
    } catch {
      /* non ancora pronto */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Il server non risponde su ${baseUrl}`);
}

export async function json(res: Response): Promise<unknown> {
  const testo = await res.text();
  try {
    return JSON.parse(testo);
  } catch {
    throw new Error(`Risposta non JSON (${res.status}): ${testo.slice(0, 200)}`);
  }
}

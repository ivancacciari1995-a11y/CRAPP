// Healthcheck del container: sano se l'ultimo ciclo riuscito è recente (vedi mailer.mjs).
import { readFile } from "node:fs/promises";
import { staSano } from "./mailer-core.ts";

const FILE_SALUTE = process.env.MAILER_FILE_SALUTE ?? "/tmp/mailer-ok";
const MAX_MS = 5 * 60_000;

const ultimo = await readFile(FILE_SALUTE, "utf8")
  .then((t) => Number(t))
  .catch(() => null);
process.exit(staSano(Number.isFinite(ultimo) ? ultimo : null, Date.now(), MAX_MS) ? 0 : 1);

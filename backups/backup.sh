#!/usr/bin/env bash
# Backup completo di disaster recovery: schema + dati DB, utenti auth, file storage.
# Uso:
#   ./backups/backup.sh              crea backups/YYYYMMDD_HHMM/ con dentro tutto
#   ./backups/backup.sh --encrypt    come sopra, poi comprime e cifra con gpg (chiede una passphrase)
#
# Richiede: essere già collegati al progetto Supabase (supabase login + link, già fatto
# in questo repo) e avere .env con VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d_%H%M)"
RUN_DIR="$SCRIPT_DIR/$STAMP"

mkdir -p "$RUN_DIR"
echo "==> Backup in $RUN_DIR"

echo "==> Dump schema pubblico"
npx supabase db dump --linked -f "$RUN_DIR/schema_public.sql"

echo "==> Dump dati pubblici"
npx supabase db dump --linked --data-only -f "$RUN_DIR/data_public.sql"

echo "==> Dump schema auth"
npx supabase db dump --linked --schema auth -f "$RUN_DIR/schema_auth.sql"

echo "==> Dump dati auth (utenti)"
npx supabase db dump --linked --schema auth --data-only -f "$RUN_DIR/data_auth.sql"

echo "==> Download file storage (bucket)"
node "$SCRIPT_DIR/download-storage.mjs" "$RUN_DIR/storage"

echo "==> Backup completato: $RUN_DIR"

if [[ "${1:-}" == "--encrypt" ]]; then
  ARCHIVE="$RUN_DIR.tar.gz.gpg"
  echo "==> Comprimo e cifro in $ARCHIVE (verrà chiesta una passphrase)"
  tar -C "$SCRIPT_DIR" -czf - "$STAMP" | gpg --symmetric --cipher-algo AES256 -o "$ARCHIVE"
  rm -rf "$RUN_DIR"
  echo "==> Archivio cifrato pronto: $ARCHIVE"
  echo "    Per estrarlo: gpg -d $ARCHIVE | tar xz"
fi

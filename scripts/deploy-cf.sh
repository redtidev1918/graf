#!/usr/bin/env bash
# Graf one-shot deployment helper.
#   prerequisites: node/npm installed; run 'npx wrangler login' once (or set CLOUDFLARE_API_TOKEN).
#   usage:        ADMIN_USERNAME=admin ADMIN_PASSWORD='...' ./scripts/deploy-cf.sh
#   optional:     SECRET=... (else generated with openssl)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> checking Cloudflare auth"
if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "Not authenticated. Please run:  npx wrangler login"
  echo "or export CLOUDFLARE_API_TOKEN=<token> and retry."
  exit 1
fi

DB_NAME="graf"
TOML="wrangler.toml"

echo "==> creating D1 database if needed"
if grep -q 'REPLACE_WITH_YOUR_D1_DATABASE_ID' "$TOML"; then
  OUT=$(npx wrangler d1 create "$DB_NAME" 2>&1)
  ID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f-]{20,}' | head -1)
  if [ -z "$ID" ]; then
    echo "Could not parse database_id from:"
    echo "$OUT"
    exit 1
  fi
  echo "created D1 database id: $ID"
  node -e 'const fs=require("fs");const f=process.argv[1],id=process.argv[2];let s=fs.readFileSync(f,"utf8");s=s.replace(/REPLACE_WITH_YOUR_D1_DATABASE_ID/g,id);fs.writeFileSync(f,s)' "$TOML" "$ID"
  echo "patched $TOML"
else
  echo "D1 database_id already configured"
fi

echo "==> secrets"
SECRET_VAL="${SECRET:-}"
if [ -z "$SECRET_VAL" ]; then
  SECRET_VAL=$(openssl rand -hex 32)
fi
echo "$SECRET_VAL" | npx wrangler secret put SECRET >/dev/null

if [ -z "${ADMIN_USERNAME:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "ADMIN_USERNAME / ADMIN_PASSWORD are required (env vars)."
  exit 1
fi
echo "$ADMIN_USERNAME" | npx wrangler secret put ADMIN_USERNAME >/dev/null
echo "$ADMIN_PASSWORD" | npx wrangler secret put ADMIN_PASSWORD >/dev/null

echo "==> applying migrations"
npx wrangler d1 migrations apply "$DB_NAME" --remote

echo "==> deploying"
npx wrangler deploy

echo
echo "Done. Visit /admin to log in with your ADMIN_USERNAME/ADMIN_PASSWORD."

#!/bin/sh
# Graf 容器入口：写入本地密钥 -> 建表(本地 SQLite) -> 启动服务
set -e
cd /app

if [ -n "${SECRET:-}" ] && [ ! -f .dev.vars ]; then
  : > .dev.vars
  printf 'SECRET=%s\n' "$SECRET" >> .dev.vars
  [ -n "${ADMIN_USERNAME:-}" ] && printf 'ADMIN_USERNAME=%s\n' "$ADMIN_USERNAME" >> .dev.vars
  [ -n "${ADMIN_PASSWORD:-}" ] && printf 'ADMIN_PASSWORD=%s\n' "$ADMIN_PASSWORD" >> .dev.vars
fi

echo "==> 应用本地数据库迁移 ..."
npx wrangler d1 migrations apply graf --local || true

echo "==> Graf 启动: http://localhost:8787"
exec npx wrangler dev --local --port 8787 --ip 0.0.0.0

#!/usr/bin/env bash
# ================================================================
# Graf 一键式全自动部署脚本（傻瓜版）
#
# 一条命令即可完成:
#   登录检测 -> (可选)创建 D1 数据库 -> 写入密钥 -> 建表 -> 部署 -> 自检
#
# 用法（已在仓库内）:
#   ./scripts/deploy-cf.sh
#   ADMIN_USERNAME=admin ADMIN_PASSWORD='你的密码' ./scripts/deploy-cf.sh
#   # 不提供时脚本会交互式询问，密码输入不回显
#
# 全新机器一键（自动 clone + 部署）:
#   bash <(curl -fsSL https://raw.githubusercontent.com/redtidev1918/graf/master/scripts/install.sh)
# ================================================================
set -euo pipefail

BOLD='\033[1m'
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
RESET='\033[0m'

info()  { echo "${GREEN}==>${RESET} $*"; }
warn()  { echo "${YELLOW}!! ${RESET}$*" >&2; }
fail()  { echo "${RED}✗ $*${RESET}" >&2; exit 1; }
ok()    { echo "${GREEN}✓${RESET} $*"; }

cd "$(dirname "$0")/.."

info "Graf 一键部署开始"

# ---------- 1. 前置检查 ----------
command -v node >/dev/null 2>&1 || fail "未检测到 Node.js，请先安装: https://nodejs.org (>=18)"
command -v npm >/dev/null 2>&1 || fail "未检测到 npm，请先安装 Node.js"
command -v git >/dev/null 2>&1 || fail "未检测到 git，请先安装: https://git-scm.com"
NODE_MAJOR=$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 版本过低(当前 v$NODE_MAJOR)，需要 >=18"

info "依赖安装（首次较慢，之后秒过）"
if [ ! -d node_modules ]; then npm install --no-audit --no-fund; else ok "依赖已就绪"; fi

# ---------- 2. Cloudflare 登录检查 ----------
info "检查 Cloudflare 登录态"
if ! npx wrangler whoami >/dev/null 2>&1; then
  echo ""
  echo "  需要先登录 Cloudflare（一次性）。二选一："
  echo "    方式1（推荐）: npx wrangler login   # 浏览器授权"
  echo "    方式2       : export CLOUDFLARE_API_TOKEN=<你的Token> 然后重跑本脚本"
  fail "未登录 Cloudflare"
fi
ok "Cloudflare 已登录"

# ---------- 3. 收集站点配置 ----------
read -rp "站点名(默认 Graf): " SITE_NAME_INPUT
SITE_NAME_VAL=${SITE_NAME_INPUT:-Graf}
read -rp "是否开启评论功能? [Y/n]: " COMMENTS_INPUT
case "$COMMENTS_INPUT" in
  n|N|no) COMMENTS_VAL=false ;;
  *) COMMENTS_VAL=true ;;
esac

# ---------- 4. 后台账号 ----------
ADMIN_USERNAME_VAL=${ADMIN_USERNAME:-}
ADMIN_PASSWORD_VAL=${ADMIN_PASSWORD:-}
if [ -z "$ADMIN_USERNAME_VAL" ]; then
  read -rp "管理员用户名(用于 /admin 登录): " ADMIN_USERNAME_VAL
fi
if [ -z "$ADMIN_PASSWORD_VAL" ]; then
  while :; do
    read -rsp "管理员密码(输入不可见): " ADMIN_PASSWORD_VAL; echo
    read -rsp "再次输入确认: " CONFIRM; echo
    [ -n "$ADMIN_PASSWORD_VAL" ] && [ "$ADMIN_PASSWORD_VAL" = "$CONFIRM" ] && break
    warn "两次输入不一致或为空，请重试"
  done
fi
case "$ADMIN_USERNAME_VAL" in *[\ \/]*|'') fail "管理员用户名不能为空且不能含空格/斜杠" ;; esac

# ---------- 5. 密钥 ----------
SECRET_VAL=${SECRET:-}
if [ -z "$SECRET_VAL" ]; then
  SECRET_VAL=$(openssl rand -hex 32 2>/dev/null || node -e 'const c=require("crypto");process.stdout.write(c.randomBytes(32).toString("hex"))')
fi

# ---------- 6. D1 数据库 ----------
DB_NAME="graf"
TOML="wrangler.toml"
info "D1 数据库检查"
if grep -q 'REPLACE_WITH_YOUR_D1_DATABASE_ID' "$TOML"; then
  info "创建数据库 $DB_NAME ..."
  OUT=$(npx wrangler d1 create "$DB_NAME" 2>&1 || true)
  ID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f-]{20,}' | head -1 || true)
  if [ -z "$ID" ]; then
    echo "$OUT"
    fail "无法从输出解析 database_id（若已存在同名库，请手动把 id 填入 wrangler.toml）"
  fi
  node -e 'const fs=require("fs");const f=process.argv[1],id=process.argv[2];let s=fs.readFileSync(f,"utf8");s=s.replace(/REPLACE_WITH_YOUR_D1_DATABASE_ID/g,id);fs.writeFileSync(f,s)' "$TOML" "$ID"
  ok "数据库已创建并写入 wrangler.toml"
else
  ok "数据库配置已存在"
fi

# ---------- 7. 写入站点配置与密钥 ----------
info "写入站点配置 [vars]"
node -e 'const fs=require("fs");const f=process.argv[1],name=process.argv[2],comments=process.argv[3];let s=fs.readFileSync(f,"utf8");s=s.replace(/SITE_NAME = \"[^\"]*\"/,"SITE_NAME = \""+name+"\"");s=s.replace(/ENABLE_COMMENTS = \"[^\"]*\"/,"ENABLE_COMMENTS = \""+comments+"\"");fs.writeFileSync(f,s)' "$TOML" "$SITE_NAME_VAL" "$COMMENTS_VAL"
ok "SITE_NAME=$SITE_NAME_VAL  ENABLE_COMMENTS=$COMMENTS_VAL"

info "写入 Secret（SECRET / ADMIN_USERNAME / ADMIN_PASSWORD）"
echo "$SECRET_VAL" | npx wrangler secret put SECRET >/dev/null
echo "$ADMIN_USERNAME_VAL" | npx wrangler secret put ADMIN_USERNAME >/dev/null
echo "$ADMIN_PASSWORD_VAL" | npx wrangler secret put ADMIN_PASSWORD >/dev/null
ok "三个 Secret 已写入 Cloudflare"

# ---------- 8. 建表 ----------
info "执行 D1 迁移（建表）"
npx wrangler d1 migrations apply "$DB_NAME" --remote
ok "数据库表结构就绪"

# ---------- 9. 类型检查与测试（可选快速自检） ----------
if npm run typecheck >/dev/null 2>&1 && npm test >/dev/null 2>&1; then
  ok "代码自检通过(typecheck + tests)"
else
  warn "代码自检未通过(可忽略继续部署，但建议检查后重试)"
fi

# ---------- 10. 部署 ----------
info "部署 Worker 到 Cloudflare ..."
DEPLOY_OUT=$(npx wrangler deploy 2>&1) || { echo "$DEPLOY_OUT"; fail "部署失败，请把上面输出贴给维护者" ; }
echo "$DEPLOY_OUT"
WORKER_URL=$(echo "$DEPLOY_OUT" | grep -oE 'https://[a-z0-9.-]+\.workers\.dev' | head -1 || true)

# ---------- 11. 自检 ----------
if [ -n "$WORKER_URL" ]; then
  info "线上自检 ..."
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "$WORKER_URL/" || true)
  if [ "$CODE" = "200" ]; then ok "首页可访问(HTTP $CODE)"; else warn "首页返回 HTTP $CODE，请检查控制台日志"; fi
  echo ""
  echo "${GREEN}================ 部署完成 ================${RESET}"
  echo "  站点地址 : $WORKER_URL"
  echo "  后台地址 : $WORKER_URL/admin"
  echo "  管理员   : $ADMIN_USERNAME_VAL（密码为你刚才设置的值）"
  echo ""
  echo "  后续操作建议:"
  echo "    · 绑定自定义域名后，把 BASE_URL 加入 wrangler.toml [vars] 再重跑本脚本"
  echo "    · 再次部署只需重跑本脚本（幂等，可反复执行）"
  echo "    · 数据备份/恢复见 /admin → Export/Import"
  echo "${GREEN}===========================================${RESET}"
else
  ok "部署完成（未能从输出解析 workers.dev 地址，请在上方查看）"
fi

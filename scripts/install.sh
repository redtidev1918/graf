#!/usr/bin/env bash
# ================================================================
# Graf 一键安装 + 自动部署（给还没有克隆仓库的新机器用）
#
# 使用（复制粘贴这一行即可）:
#   bash <(curl -fsSL https://raw.githubusercontent.com/redtidev1918/graf/master/scripts/install.sh)
#
# 或先设好后台账号再跑(免交互问答):
#   ADMIN_USERNAME=admin ADMIN_PASSWORD='你的密码' \
#     bash <(curl -fsSL https://raw.githubusercontent.com/redtidev1918/graf/master/scripts/install.sh)
# ================================================================
set -euo pipefail

RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[33m'; RESET='\033[0m'
info() { echo "${GREEN}==>${RESET} $*"; }
warn() { echo "${YELLOW}!! ${RESET}$*" >&2; }
fail() { echo "${RED}✗ $*${RESET}" >&2; exit 1; }

command -v git >/dev/null 2>&1 || fail "未检测到 git，请先安装 https://git-scm.com"
command -v node >/dev/null 2>&1 || fail "未检测到 Node.js(>=18)，请先安装 https://nodejs.org"
command -v npm >/dev/null 2>&1 || fail "未检测到 npm"

REPO=https://github.com/redtidev1918/graf.git
DIR=graf

if [ -d "$DIR" ]; then
  warn "目录 $DIR 已存在，进入并拉取最新代码"
  cd "$DIR"
  git pull --ff-only 2>/dev/null || true
else
  info "克隆仓库 $REPO ..."
  git clone --depth 1 "$REPO" "$DIR" || fail "克隆失败，请检查网络"
  cd "$DIR"
fi

export ADMIN_USERNAME=${ADMIN_USERNAME:-}
export ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
exec bash scripts/deploy-cf.sh

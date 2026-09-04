#!/usr/bin/env bash
# Graf Docker 一键启动（无 Node 也可）
#   使用默认密码前请先设环境变量，如:
#     SECRET=xxx ADMIN_USERNAME=admin ADMIN_PASSWORD='你的强密码' ./scripts/docker-up.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "==> 构建并启动 Graf 容器 (http://localhost:8787)"
docker compose up -d --build
echo ""
echo "  站点: http://localhost:8787"
echo "  后台: http://localhost:8787/admin"
echo "  数据卷: graf-data (SQLite 持久化，docker compose down 不丢失)"
echo ""
echo "  停止: docker compose down    查看日志: docker compose logs -f graf"

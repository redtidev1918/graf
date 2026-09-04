# Graf 自托管（本地/内网）镜像 —— 内置 Node + wrangler，宿主无需安装 Node
FROM node:22-slim

WORKDIR /app

# 依赖（含 devDeps 中的 wrangler）
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 项目源码（migrations/静态资源/toml 等）
COPY . .

RUN chmod +x docker/entrypoint.sh

EXPOSE 8787

ENV WRANGLER_SEND_METRICS=false
ENTRYPOINT ["/app/docker/entrypoint.sh"]

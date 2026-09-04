# 部署指南（中文）

## 1. 前置条件

- Node.js >= 18、npm。
- Cloudflare 账号（Workers 免费套餐即可，D1 免费额度包含在内）。
- 自定义域名：需一个托管在 Cloudflare 的 zone（见第 7 节）。

## 1b. Docker 一键自托管（宿主机无需 Node）

```bash
SECRET=openssl-rand-hex-32 ADMIN_USERNAME=admin ADMIN_PASSWORD='你的密码' ./scripts/docker-up.sh
```

镜像内置 Node + wrangler，以本地模式运行 Graf（SQLite 数据存于 graf-data 卷），适合个人/内网；
对外发布仍推荐 Cloudflare。

## 1c. 零依赖最快路径：grafctl（单二进制）

单文件二进制，内嵌 D1 迁移与 Worker bundle，**无需克隆仓库/Node/npm**；安装脚本自动写 PATH：

```bash
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/redtidev1918/graf/master/scripts/grafctl-install.sh | sh
# Windows(PowerShell)
# irm https://raw.githubusercontent.com/redtidev1918/graf/master/scripts/grafctl-install.ps1 | iex

grafctl auth          # 首次粘贴一次 Cloudflare API Token(存到用户配置目录)
grafctl deploy --yes  # 之后零依赖一键部署(建库→迁移→Secrets→上传→开启worker.dev→自检)
```

彩色分级输出；`doctor` 只读自检、`migrate` 只跑迁移、`deploy --dry-run` 演练、`--no-color`/`--version`。

> `--yes` 在未设 `ADMIN_USERNAME`/`ADMIN_PASSWORD` 时自动生成随机管理员密码（仅显示一次）；保留原密码请先 `export ADMIN_USERNAME=admin ADMIN_PASSWORD=你的密码` 再部署。

## 2. 最快路径：一键全自动部署（推荐）

没有克隆过仓库的机器，复制这一行回车即可（自动 clone → 装依赖 → 登录检查 → 建库 →
写密钥 → 建表 → 部署 → 线上自检）：

```bash
curl -fsSL https://raw.githubusercontent.com/redtidev1918/graf/master/scripts/install.mjs -o /tmp/graf-install.mjs && node /tmp/graf-install.mjs
```

已克隆过仓库的，直接运行：

```bash
node scripts/deploy.mjs      # 或 npm run deploy:auto
```

脚本会做的事：

1. 检查 Node/npm/git 与 Cloudflare 登录态（未登录会给出一次性登录指引后退出）；
2. 交互询问站点名（默认 Graf）、是否启用评论、管理员用户名与密码（密码输入不回显、
   两次确认；也可用环境变量 ADMIN_USERNAME/ADMIN_PASSWORD 跳过问答）；
3. 自动生成 SECRET（openssl）并连同 ADMIN 凭据写入 Cloudflare Secret；
4. 若 wrangler.toml 还是占位 database_id，自动创建 D1 库并回填；
5. 执行 `wrangler d1 migrations apply --remote` 建表；
6. 快速跑一遍 typecheck 与测试作自检；
7. `wrangler deploy` 部署，解析 workers.dev 地址并 curl 自检首页；
8. 打印站点/后台地址与后续建议。

脚本幂等，可反复执行；再次部署时只需重跑同一命令。

### 2.1 平台与命令行参考

部署器为**纯 Node 脚本**，macOS / Linux / Windows 均可运行：

- 尚未克隆仓库（bootstrap）：上方 curl+node 一行即可；Windows PowerShell 用
  `curl.exe -fsSL <同上URL> -o "$env:TEMP\graf-install.mjs"` 后 `node "$env:TEMP\graf-install.mjs"`；
- 已克隆仓库：`node scripts/deploy.mjs` 或 npm 别名 `npm run deploy:auto`。

常用参数与 npm 别名：

| 命令 | 作用 |
|---|---|
| `node scripts/deploy.mjs` | 交互问答模式（推荐） |
| `node scripts/deploy.mjs --yes` / `npm run deploy:auto:yes` | 全自动：用默认值/环境变量，自动生成管理员密码并打印一次 |
| `node scripts/deploy.mjs --dry-run` / `npm run deploy:dry` | 演练：只检查与改本地配置，不触碰 Cloudflare |
| `--site-name <名>` | 站点名（默认 Graf） |
| `--no-comments` | 关闭评论 |
| `--admin-user <名>` / `--admin-pass <值>` | 跳过交互提供管理员凭据 |
| `--secret <hex>` | 指定 SECRET（默认自动生成） |
| `--skip-selfcheck` | 跳过部署前的 typecheck+测试 |
| `--no-color` / `--debug` | 关闭彩色输出 / 输出 wrangler 全量调试日志 |
| `-h` / `--help` | 帮助 |

也可用环境变量 `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`SITE_NAME`、`ENABLE_COMMENTS`、
`SECRET` 提供配置；登录态可用 `CLOUDFLARE_API_TOKEN` 替代 `wrangler login`。

日志：控制台分级输出（信息/成功/警告/错误/步骤），同时完整落盘到仓库根的
`graf-deploy.log`（已 gitignore）；失败时会提示日志路径便于排查。

## 3. 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars        # 填写 SECRET 等（已被 gitignore）
npx wrangler d1 migrations apply graf --local
npm run dev                           # http://localhost:8787
```

本地 D1 数据位于 .wrangler/state（已被 gitignore）。

## 4. 创建生产数据库

```bash
npx wrangler d1 create graf
```

把输出的 database_id 填入 wrangler.toml 的 [[d1_databases]]，然后应用表结构：

```bash
npx wrangler d1 migrations apply graf --remote
```

## 5. 密钥

```bash
npx wrangler secret put SECRET        # openssl rand -hex 32
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
```

可选：调整 wrangler.toml 的 [vars]（SITE_NAME、SITE_ID、ENABLE_COMMENTS、CACHE_TTL、
MAX_PAGE_LENGTH）。使用自定义域名时务必设置 BASE_URL，保证生成的链接为绝对地址。

## 6. 部署（手动，等价于一键脚本的第 7 步）

```bash
npm run deploy     # npx wrangler deploy
```

服务地址形如 https://graf.<子域>.workers.dev。

### 6.1. 通过 GitHub Actions 自动部署（可选）

推 `v` 开头 tag（如 v1.0.0）会触发 .github/workflows/deploy.yml：自动执行 D1 迁移并部署。
需要在仓库 Settings → Secrets and variables → Actions 添加：
CLOUDFLARE_API_TOKEN（Workers Scripts:Edit + D1:Edit）与 CLOUDFLARE_ACCOUNT_ID。
前提是 wrangler.toml 中已填写真实 database_id。

## 7. 自定义域名与路由

在 Cloudflare 添加 zone 后，于面板 Workers → graf → Settings → Domains & Routes 绑定域名
（如 notes.example.com），并设置 BASE_URL=https://notes.example.com 后重新部署。

## 8. 备份

登录 /admin 点击 Export JSON 即可导出全部数据；也可用 curl：

```bash
curl -s -b cookies.txt https://notes.example.com/admin/export > backup.json
```

恢复：登录后向 /admin/import POST 该文件（Content-Type: application/json）。
格式为 `{ format: "graf-backup", pages: […], comments: […] }`。

也可在 Cloudflare 面板 D1 → graf → Export 直接快照数据库。

## 9. 从旧版（Django 实现）迁移

1. 在旧版 Django 后台导出（Data Migration → Export Notes）得到 django-export.json；
2. 转换为 Graf 格式：

```bash
node scripts/convert-django-backup.mjs django-export.json > graf-backup.json
```

3. 登录新实例 /admin 导入 graf-backup.json。

说明：旧导出只含页面（无评论/账号）；旧 `hashcode` 字段映射为 `path`；edit_token 保留，
旧“编辑链接”在新实例仍可恢复编辑权。

## 10. 中国大陆访问（重要）

Cloudflare 边缘网络与 `*.workers.dev` 在境内常被限速或无法直连，China Network 产品需要
ICP 备案/企业级协议。若主要读者在境内，建议：

- Worker 绑自定义域名，并在你的 zone 前置国内 CDN/反代（Worker 仍为源站），或
- 继续使用 Django 版（本仓库 legacy-django tag/branch）部署在国内可达的主机上——
  Telegraph API 契约一致，导出数据可互通。

## 11. 成本与限额

- Workers 免费计划：10 万请求/天；付费计划放宽 CPU/时间限制。
- D1 免费：5 GB 存储、500 万读/天、10 万写/天（付费可提升）。
- Markdown 渲染按请求（或 CACHE_TTL 窗口）执行；接近 MAX_PAGE_LENGTH 的超大页面是唯一
  需要关注 CPU 的场景——热点可调高 CACHE_TTL。

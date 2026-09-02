# 部署指南（中文）

## 1. 前置条件

- Node.js >= 18、npm。
- Cloudflare 账号（Workers 免费套餐即可，D1 免费额度包含在内）。
- 自定义域名：需一个托管在 Cloudflare 的 zone（见第 6 节）。

## 2. 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars        # 填写 SECRET 等（已被 gitignore）
npx wrangler d1 migrations apply graf --local
npm run dev                           # http://localhost:8787
```

本地 D1 数据位于 .wrangler/state（已被 gitignore）。

## 3. 创建生产数据库

```bash
npx wrangler d1 create graf
```

把输出的 database_id 填入 wrangler.toml 的 [[d1_databases]]，然后应用表结构：

```bash
npx wrangler d1 migrations apply graf --remote
```

## 4. 密钥

```bash
npx wrangler secret put SECRET        # openssl rand -hex 32
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
```

可选：调整 wrangler.toml 的 [vars]（SITE_NAME、SITE_ID、ENABLE_COMMENTS、CACHE_TTL、
MAX_PAGE_LENGTH）。使用自定义域名时务必设置 BASE_URL，保证生成的链接为绝对地址。

## 5. 一键脚本

执行 `npx wrangler login` 后，以下脚本自动完成第 3、4 节与部署：

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD='你的密码' ./scripts/deploy-cf.sh
```

## 6. 部署

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

## 9. 从 Django 版（TeleNote）迁移

1. 在旧 Django 后台导出（Data Migration → Export Notes）得到 tapnote_backup.json；
2. 转换为 Graf 格式：

```bash
node scripts/convert-django-backup.mjs tapnote_backup.json > graf-backup.json
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

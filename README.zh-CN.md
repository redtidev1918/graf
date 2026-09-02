# Graf

Graf 是一个极简、**自托管的 Markdown 发布平台**，**兼容 [Telegra.ph](https://telegra.ph)（Telegraph API）**，
整个服务跑在 **Cloudflare Workers + D1** 上：发布即得一个短链页面，可选段落级评论。

它是 Django 项目 *TeleNote* 的 Cloudflare Workers 继任者；而 TeleNote 又源自
[vorniches/tapnote](https://github.com/vorniches/tapnote)。完整来历与版权说明见
[docs/ORIGIN.md](docs/ORIGIN.md)。

## 特性

- **Telegraph API 兼容**：createAccount / createPage / editPage / getPage / getPageList / getViews / getAccountInfo / revokeAccessToken，可作为现有 Telegraph 客户端（TelePress、各类 TG 机器人等）的直接替代。
- **Markdown 页面**：免登录即发即得；支持删除线、表格、围栏代码、脚注、YouTube 嵌入与 Open Graph 社交卡片。
- **ParaNote 兼容评论**：段落级评论 + 点赞，前端用仓库自带的 paranote.js，服务端协议与 TeleNote 一致（/api/v1/comments 等）。
- **跑在边缘**：TypeScript + D1(SQLite)，无 VPS、无 Python、无 Docker；可选 CACHE_TTL 做匿名读者 HTML 缓存。
- **数据自持**：/admin 提供完整 JSON 备份与恢复。
- **轻量后台**：登录后可管理页面/评论、拉黑、导入导出。
- **默认安全**：Markdown 中的原始 HTML 一律不穿透（杜绝存储型 XSS）；匿名身份用 HMAC 派生（不可反推 IP）；后台会话 cookie 签名；严格 CSP。

## 快速开始

前置：Node.js ≥ 18、Cloudflare 账号（免费 Workers 套餐即可）。

1. 克隆并安装依赖

```bash
git clone <your-repo-url> graf
cd graf
npm install
```

2. 创建 D1 数据库并把 id 填进 wrangler.toml

```bash
npx wrangler d1 create graf   # 输出 database_id
# 把 id 填入 wrangler.toml 的 [[d1_databases]] database_id
npx wrangler d1 migrations apply graf --remote
```

3. 配置密钥（切勿提交）

```bash
cp .dev.vars.example .dev.vars   # 填写 SECRET / ADMIN_USERNAME / ADMIN_PASSWORD
npx wrangler secret put SECRET
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
```

4. 本地运行或部署

```bash
npm run dev      # http://localhost:8787
npm run deploy   # 发布到 workers.dev 或自定义路由
```

打开首页 → 写 Markdown → 点 Publish，即可得到形如 https://your-worker.example/Ab3xYz90/ 的短链。
edit_token 保存在 HttpOnly cookie 中；页面上还有“复制编辑链接”可在别的浏览器恢复编辑权。

## 配置项

| 变量 | 默认 | 说明 |
|---|---|---|
| SECRET | 必填 | HMAC 密钥：后台会话与匿名评论身份派生。生成：openssl rand -hex 32 |
| SITE_NAME | Graf | 站点名（标题/OG） |
| SITE_ID | default | 评论数据命名空间 |
| ENABLE_COMMENTS | true | 设为 false 关闭评论 API 与 UI |
| MAX_PAGE_LENGTH | 200000 | 单篇正文最大字符数 |
| CACHE_TTL | 0 | 匿名读者 HTML 缓存秒数（0=关） |
| BASE_URL | 自动 | 生成绝对链接用的公开地址 |
| ADMIN_USERNAME / ADMIN_PASSWORD | 未设置 | 设置后启用 /admin |

## API

Telegraph 方法都在站点根路径，同时接受 JSON 与表单 POST（getPage/getViews 也接受 GET）：

```bash
curl -X POST https://your-worker.example/createPage \
  --data-urlencode 'title=My Page' \
  --data-urlencode 'access_token=YOUR_TOKEN' \
  --data-urlencode 'content=[{"tag":"p","children":["Hello world"]}]'
```

完整参考：[docs/API.md](docs/API.md)。

## 评论

ENABLE_COMMENTS=true 时页面会自动加载 assets/js/paranote.js，提供段落侧边评论、点赞；
持有编辑令牌的作者可删除评论；管理员可在 /admin 拉黑。协议与 TeleNote 一致。

## 一键部署

已登录 Cloudflare 后，设置后台凭据并运行（自动建库、回填 wrangler.toml、写 secret、迁移、部署）：

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD='你的密码' ./scripts/deploy-cf.sh
```

## 开发

```bash
npm test            # vitest 单测
npm run typecheck   # tsc --noEmit
npm run db:migrate:local
```

## 来历与许可

- vorniches/tapnote —— 原始 Django 项目（MIT, © 2025 Sergei Vorniches）。
- TeleNote（zoidberg-xgd → redtidev1918）—— tapnote 的功能性 fork（评论、Telegraph API、编辑器、封禁、工具链）。
- Graf —— 2026 年以 TypeScript 重写 TeleNote，部署于 Cloudflare Workers/D1。

详见 [docs/ORIGIN.md](docs/ORIGIN.md) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。


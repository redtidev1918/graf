# Graf

极简、**自托管的 Markdown 发布平台**，**兼容 Telegra.ph（Telegraph API）**，整个服务跑在
**Cloudflare Workers + D1** 上：发布即得一个短链页面，可选段落级评论。

> 英文版：[README.md](README.md) ｜ 原项目关系：[docs/ORIGIN.zh-CN.md](docs/ORIGIN.zh-CN.md)

## 特性

- **Telegraph API 兼容**：createAccount / getAccountInfo / revokeAccessToken / createPage /
  editPage / getPage / getPageList / getViews —— 可直接替代 Telegra.ph，供 TelePress、各类
  Telegram 机器人等既有客户端使用。
- **Markdown 页面**：免登录即写即发；支持删除线、表格、围栏代码、脚注、YouTube 嵌入与
  Open Graph 社交卡片。
- **ParaNote 兼容评论**：段落级评论 + 点赞；前端使用仓库自带的 paranote.js，
  服务端协议与 TeleNote 一致（/api/v1/comments 等）。
- **跑在边缘**：TypeScript + D1（SQLite），无需 VPS、Python 或 Docker；可选 CACHE_TTL
  对匿名读者做 HTML 边缘缓存。
- **数据自持**：/admin 提供完整 JSON 备份与恢复（含旧 Django 版数据迁移脚本）。
- **轻量后台**：登录后可管理页面 / 评论、封禁用户、导入导出。
- **默认安全**：Markdown 中的原始 HTML 一律不穿透（杜绝存储型 XSS）；匿名评论身份由
  HMAC 派生（不可反推 IP）；后台会话 cookie 带签名；默认开启严格 CSP 等安全响应头。

## 快速开始

前置：Node.js >= 18、Cloudflare 账号（免费 Workers 套餐即可）。

```bash
git clone <your-repo-url> graf
cd graf
npm install

# 1) 创建 D1 数据库，把输出的 database_id 填入 wrangler.toml 的 [[d1_databases]]
npx wrangler d1 create graf

# 2) 配置密钥（SECRET 必须更换；ADMIN_* 用于 /admin 登录）
cp .dev.vars.example .dev.vars
npx wrangler secret put SECRET
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD

# 3) 建表 + 本地运行或部署
npx wrangler d1 migrations apply graf --remote
npm run dev          # http://localhost:8787
npm run deploy       # 上线（workers.dev 或自定义路由）
```

登录 Cloudflare 后也可用一键脚本（自动建库、回填 wrangler.toml、写 secret、迁移、部署）：

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD='你的密码' ./scripts/deploy-cf.sh
```

打开首页 → 写 Markdown → 点 Publish，即可得到形如 `https://your-worker.example/Ab3xYz90/`
的短链。edit_token 保存在 HttpOnly cookie 中；页面上还有「复制编辑链接」，可在别的浏览器
恢复编辑权。

## 配置项

所有配置走环境变量（wrangler.toml 的 [vars] 或 Secret）：

| 变量 | 默认 | 说明 |
|---|---|---|
| SECRET | 必填 | HMAC 密钥：后台会话与匿名评论身份派生（openssl rand -hex 32） |
| SITE_NAME | Graf | 站点名（标题 / Open Graph） |
| SITE_ID | default | 评论数据命名空间（评论按 site 隔离） |
| ENABLE_COMMENTS | true | 设为 false 关闭评论 API 与 UI |
| MAX_PAGE_LENGTH | 200000 | 单篇正文最大字符数 |
| CACHE_TTL | 0 | 匿名读者 HTML 缓存秒数（0 = 关闭） |
| BASE_URL | 自动 | 生成绝对链接用的公开地址（自定义域名务必设置） |
| ADMIN_USERNAME / ADMIN_PASSWORD | 未设置 | 设置后启用 /admin |

## API

Telegraph 方法都在站点根路径，同时接受 JSON 与表单 POST（getPage / getViews 也接受 GET）：

```bash
curl -X POST https://your-worker.example/createPage \
  --data-urlencode 'title=My Page' \
  --data-urlencode 'access_token=YOUR_TOKEN' \
  --data-urlencode 'content=[{"tag":"p","children":["Hello world"]}]'
```

完整中文参考：[docs/API.zh-CN.md](docs/API.zh-CN.md)

## 评论

ENABLE_COMMENTS=true 时页面自动加载 assets/js/paranote.js，提供段落侧边评论与点赞；
持有编辑令牌的作者可删除评论；管理员可在 /admin 拉黑。协议与 TeleNote 一致。

## 文档导航

| 文档 | 英文 | 中文 |
|---|---|---|
| 项目说明 | [README.md](README.md) | [README.zh-CN.md](README.zh-CN.md) |
| 原项目关系与血统 | [docs/ORIGIN.md](docs/ORIGIN.md) | [docs/ORIGIN.zh-CN.md](docs/ORIGIN.zh-CN.md) |
| API 参考 | [docs/API.md](docs/API.md) | [docs/API.zh-CN.md](docs/API.zh-CN.md) |
| 部署指南 | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.zh-CN.md](docs/DEPLOYMENT.zh-CN.md) |
| 架构说明 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | [docs/ARCHITECTURE.zh-CN.md](docs/ARCHITECTURE.zh-CN.md) |
| 变更记录 | [CHANGELOG.md](CHANGELOG.md) | [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md) |
| 第三方声明 | [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | [THIRD_PARTY_NOTICES.zh-CN.md](THIRD_PARTY_NOTICES.zh-CN.md) |

## 与原项目的关系

- **vorniches/tapnote**（Django，MIT）—— 本项目的最初原型；
- **TeleNote**（zoidberg-xgd → redtidev1918）—— tapnote 的功能性 fork，Graf 的行为契约来源；
- **Graf** —— 2026 年以 TypeScript 为 Cloudflare Workers/D1 的重写，作为独立通用的新项目发布。

完整说明见 [docs/ORIGIN.zh-CN.md](docs/ORIGIN.zh-CN.md)；旧 Django 代码保留在 tag/branch
`legacy-django`。

## 致谢（Acknowledgments）

本项目站在许多开源项目与作者的肩上，谨致谢意：

- **[vorniches/tapnote](https://github.com/vorniches/tapnote)**（Sérgio Vorniches）——
  最初的 Django 实现与 Telegra.ph 式发布理念，本项目的功能与数据契约由此而来；
- **[TeleNote](https://github.com/redtidev1918/TeleNote) fork 生态**——Telegraph API 兼容层、
  ParaNote 评论整合、编辑器与社交预览、封禁与工具链的设计；
- **[Paranote](https://github.com/kkty/paranote)**（kkty）及其派生 fork——段落级评论系统
  的开创，仓库内 paranote.js 客户端即来自该家族；
- **[Telegra.ph / Telegraph API](https://telegra.ph/api)**——简洁发布体验与公开 API 的设计灵感；
- **[markdown-it](https://github.com/markdown-it/markdown-it)** 与
  [markdown-it-footnote](https://github.com/markdown-it/markdown-it-footnote)（Vitaly Puzrin 等）——
  本项目的 Markdown 渲染引擎；
- **Django / Python-Markdown**——旧版本赖以运行的成熟基础；
- **Cloudflare Workers / D1 / wrangler**——让本项目无需任何服务器的运行平台；
- 以及所有反馈过问题、提过建议的使用者。

（法律层面的第三方声明见 [THIRD_PARTY_NOTICES.zh-CN.md](THIRD_PARTY_NOTICES.zh-CN.md)。）

## 参考（References）

- Telegra.ph 官方 API：https://telegra.ph/api
- Cloudflare Workers 文档：https://developers.cloudflare.com/workers/
- Cloudflare D1 文档：https://developers.cloudflare.com/d1/
- wrangler CLI：https://developers.cloudflare.com/workers/wrangler/
- vorniches/tapnote（原始项目）：https://github.com/vorniches/tapnote
- Paranote（评论系统原型）：https://github.com/kkty/paranote
- TelePress（Telegraph 发布 CLI）：https://github.com/redtidev1918/TelePress
- markdown-it：https://github.com/markdown-it/markdown-it
- Python-Markdown：https://python-markdown.github.io/
- 本仓库 Releases：https://github.com/redtidev1918/TeleNote/releases

## 许可

MIT License。原始上游版权归 Sergei Vorniches（tapnote）所有；fork 与本次重写版权归
redtidev1918。详见 [LICENSE](LICENSE) 与 [THIRD_PARTY_NOTICES.zh-CN.md](THIRD_PARTY_NOTICES.zh-CN.md)。

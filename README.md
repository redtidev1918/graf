
# Graf

极简、**自托管的 Markdown 发布平台**，**兼容 Telegra.ph（Telegraph API）**，整个服务跑在
**Cloudflare Workers + D1** 上：发布即得一个短链页面，可选段落级评论。

> English: [README.en.md](README.en.md)

## 特性

- **Telegraph API 兼容**：createAccount / getAccountInfo / revokeAccessToken / createPage /
  editPage / getPage / getPageList / getViews —— 可直接替代 Telegra.ph，供 TelePress、各类
  Telegram 机器人等既有客户端使用。
- **Markdown 页面**：免登录即写即发；支持删除线、表格、围栏代码、脚注、YouTube 嵌入与
  Open Graph 社交卡片。
- **ParaNote 兼容评论**：段落级评论 + 点赞；前端使用仓库自带的 paranote.js，
  协议端点：/api/v1/comments、like、ban。
- **跑在边缘**：TypeScript + D1（SQLite），无需 VPS、Python 或 Docker；可选 CACHE_TTL
  对匿名读者做 HTML 边缘缓存。
- **数据自持**：/admin 提供完整 JSON 备份与恢复（含旧 Django 版数据迁移脚本）。
- **轻量后台**：登录后可管理页面 / 评论、封禁用户、导入导出。
- **默认安全**：Markdown 中的原始 HTML 一律不穿透（杜绝存储型 XSS）；匿名评论身份由
  HMAC 派生（不可反推 IP）；后台会话 cookie 带签名；默认开启严格 CSP 等安全响应头。

## 快速开始

**最省事——一条命令全自动部署**（自动完成：克隆 → 装依赖 → 登录检查 → 创建数据库 →
写入密钥 → 建表 → 部署 → 线上自检）：

```bash
curl -fsSL https://raw.githubusercontent.com/redtidev1918/graf/master/scripts/install.mjs -o /tmp/graf-install.mjs && node /tmp/graf-install.mjs
```

已在本地克隆过仓库的，直接运行（二选一）：

```bash
node scripts/deploy.mjs      # 或 npm run deploy:auto
```

脚本会交互询问：站点名（默认 Graf）、是否启用评论、管理员用户名与密码（输入不回显、
二次确认）。想跳过问答可先用环境变量提供（也可加 `--yes` 全自动，管理员密码自动生成并打印一次；
`--dry-run` 可先演练）。Windows 同样支持（脚本为纯 Node，PowerShell 里把下载路径换成
`$env:TEMP` 即可，详见 [docs/DEPLOYMENT.zh-CN.md](docs/DEPLOYMENT.zh-CN.md)）。

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD='你的密码' node scripts/deploy.mjs
```

### 手动分步（可选）

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

打开首页 → 写 Markdown → 点 Publish，即可得到形如 `https://your-worker.example/Ab3xYz90/`
的短链。edit_token 保存在 HttpOnly cookie 中；页面上还有「复制编辑链接」，可在别的浏览器
恢复编辑权。

## 配置项

所有配置走环境变量（wrangler.toml 的 [vars] 或 Secret）：

| 变量 | 默认 | 说明 |
|---|---|---|
| SECRET | 评论/后台启用时必填（默认都开） | HMAC 密钥：后台会话与匿名评论身份派生（openssl rand -hex 32）；仅当 ENABLE_COMMENTS=false 且未配置 ADMIN_* 时可省略 |
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
持有编辑令牌的作者可删除评论；管理员可在 /admin 拉黑。

## 文档导航

| 文档 | 英文 | 中文 |
|---|---|---|
| 项目说明 | [README.en.md](README.en.md) | [README.md](README.md) |
| 项目历史 | [docs/HISTORY.md](docs/HISTORY.md) | [docs/HISTORY.zh-CN.md](docs/HISTORY.zh-CN.md) |
| API 参考 | [docs/API.md](docs/API.md) | [docs/API.zh-CN.md](docs/API.zh-CN.md) |
| 部署指南 | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.zh-CN.md](docs/DEPLOYMENT.zh-CN.md) |
| 架构说明 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | [docs/ARCHITECTURE.zh-CN.md](docs/ARCHITECTURE.zh-CN.md) |
| 变更记录 | [CHANGELOG.md](CHANGELOG.md) | [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md) |
| 第三方声明 | [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | [THIRD_PARTY_NOTICES.zh-CN.md](THIRD_PARTY_NOTICES.zh-CN.md) |

## 历史

本项目由早期实现发展而来，完整血统与演变见 [docs/HISTORY.zh-CN.md](docs/HISTORY.zh-CN.md)；
早期代码留存于 tag/branch `legacy-django`。

## 致谢

本项目借鉴或依赖以下外部项目与规范，谨致谢意：

- **Sérgio Vorniches**（MIT）—— 本项目设计所源自的早期发布站实现的作者；
- **ParaNote**（作者的项目 [redtidev1918/paranote](https://github.com/redtidev1918/paranote)）—— 段落级评论协议与前端客户端来源；
- **Telegra.ph / Telegraph API** —— 发布体验与公开 API 规范的参考；
- **markdown-it、markdown-it-footnote**（MIT）—— Markdown 渲染引擎；
- **Django、Python-Markdown** —— 旧版实现所依赖的生态；
- **Cloudflare（Workers / D1 / wrangler）** —— 运行平台。

（第三方法律声明见 [THIRD_PARTY_NOTICES.zh-CN.md](THIRD_PARTY_NOTICES.zh-CN.md)。）

## 参考

- Telegra.ph API 规范：https://telegra.ph/api
- Cloudflare Workers：https://developers.cloudflare.com/workers/
- Cloudflare D1：https://developers.cloudflare.com/d1/
- wrangler：https://developers.cloudflare.com/workers/wrangler/
- ParaNote（段落评论协议）：https://github.com/redtidev1918/paranote
- markdown-it：https://github.com/markdown-it/markdown-it
- Python-Markdown：https://python-markdown.github.io/

## 许可

MIT License。版权与第三方署名详见 [LICENSE](LICENSE) 与 [THIRD_PARTY_NOTICES.zh-CN.md](THIRD_PARTY_NOTICES.zh-CN.md)。

# 变更记录（中文）

## Unreleased

- grafctl 0.3.0：Token 持久化(`auth`)、自动开启 worker.dev、彩色分级日志 + `--no-color`、一键安装脚本(sh 与 PowerShell `irm | iex`)、分平台发布二进制。

## [1.3.0] - 2026-09-04

### 新增

- 静态资源内嵌为单文件 Worker bundle（无需 assets binding 也可部署）。
- `grafctl`：Go 跨平台部署器（Cloudflare API 直连、无需 Node），doctor / migrate / deploy，支持 --yes/--dry-run；打 `grafctl-v*` tag 由 goreleaser 分平台发版。
- Docker 一键自托管（宿主机无需 Node）。

## [1.2.0] - 2026-09-03

### 新增

- 单篇下载 Markdown（`/{path}/download`）、整本书下载 TXT（`/book/{slug}/download`）。
- 编辑器作者工具：草稿自动保存（localStorage，仅新文章）+ 实时字数统计。

## [1.1.0] - 2026-09-03

### 新增

- 小说模式（BOOKS_ENABLED）：books + pages.book_id/order_num（迁移 0003）、/books 与 /book/{id} 目录、
  章节上下页导航、后台「作品」管理；备份携带作品元数据。
- 界面默认简体中文。

### 修复

- 生产 D1 batch 协议（需 prepare 语句）——远程部署测试发现。
- CI 矩阵改用 Node 22/24（集成测试需要 node:sqlite）。

## [1.0.1] - 2026-09-03

稳定性加固：在现有架构上完成数据一致性、安全与契约测试（无重构），测试从 25 增至 88（基于 SQLite 的路由级测试）。

### 修复

- 页面删除不再遗留孤儿评论/点赞（原子清理顺序）。
- 评论删除原子地移除其点赞。
- 备份：schema 校验、原子批量导入、页面/评论幂等、不导出原始 IP 与 access_token、/admin 显示凭据警告。
- 编辑令牌：?token= 授权后 303 跳转到干净 URL；编辑页 GET 持久化 cookie 使表单 POST 可用。
- 后台：登录 next 开放重定向修复、Cookie 变更请求来源(CSRF)校验、轻量登录暴力破解限流、页面/评论分页。
- SECRET 在评论或后台启用时强制（配置错误页面 fail-fast）。
- HEAD 请求镜像 GET 且不增加浏览量；仅 HTML GET 计数。
- Telegraph API 输入校验：标题/作者长度、节点深度/数量、超大 JSON。
- deploy.mjs --dry-run 不再需要 Cloudflare 凭据。

### 新增

- Telegraph(21)/ParaNote(10) 契约测试；admin(13)/web(13)/数据一致性/配置语义/备份往返集成测试（SQLite 适配器）。
- 迁移 0002：评论去重索引。
- 环境变量：COMMENT_RATE_LIMIT、LIKE_RATE_LIMIT。

Graf 的显著变更记录于此。遵循语义化版本，Release 以 vX.Y.Z 打 tag。

## [1.0.0] - 2026-09-03

首个正式版。Graf 是以 Cloudflare Workers/D1 实现的发布平台（项目血统见 docs/HISTORY.zh-CN.md）。

### 新增

- Telegraph 兼容 API：createAccount / getAccountInfo / revokeAccessToken / createPage /
  editPage / getPage / getPageList / getViews（支持 JSON 或表单 body；getPage/getViews 亦支持 GET）。
- Markdown 发布：免登录编辑器、8 位短链、Open Graph/Twitter 卡片、<del> 删除线、脚注、
  围栏代码、表格、YouTube 嵌入。
- ParaNote 兼容评论：段落侧边评论 UI（assets/js/paranote.js）、按访客幂等的点赞、
  作者删除权、管理员封禁；端点 /api/v1/comments、/api/v1/comments/like、/api/v1/ban。
- /admin 后台：HMAC 签名会话登录、看板、页面/评论管理、封禁、JSON 导出/导入。
- Cloudflare D1 存储（migrations/0001_init.sql）；可选 CACHE_TTL 边缘 HTML 缓存。
- 工具链：wrangler v4、vitest（nodes/render/ids/util 单测）、tsc --noEmit 零错误、
  GitHub Actions CI、跨平台一键部署脚本 scripts/deploy.mjs（引导脚本 scripts/install.mjs）、Django 备份转换脚本
  scripts/convert-django-backup.mjs。
- 文档：README（中/英）、API/部署/架构/原项目关系文档、MIT 许可（含上游署名）、第三方声明。

### 安全

- Markdown 中的原始 HTML 不再透传（消除 Django 渲染器的存储型 XSS 面）；严格 CSP 等安全头；
  HttpOnly/SameSite cookie；匿名评论身份改为 HMAC 派生（旧 md5(ip+site) 可反推）；
  管理员会话 cookie 带签名；按 IP/分钟限流评论与点赞；YouTube 嵌入经过校验。

### 相对 Django 版的修复

- getPage 曾固定返回 views=0 —— 现返回真实计数。
- 数据导入逐条校验，不再因畸形备份整体崩溃。
- 链接处理改为正确 URL 解析（杜绝经构造 href 的属性注入）。

### 有意移除

- Python/Django 运行时、Docker/PythonAnywhere 部署与 Selenium 续期脚本。
- Django admin（替换为内置轻量 /admin）。
- 正文中原始 HTML/iframe 的透传。

### 历史留存

- 旧 Django 时代的代码库保留于 tag/branch `legacy-django`（见 docs/HISTORY.zh-CN.md）。

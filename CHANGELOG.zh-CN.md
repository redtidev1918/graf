# 变更记录（中文）

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
  GitHub Actions CI、一键部署脚本 scripts/deploy-cf.sh、Django 备份转换脚本
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

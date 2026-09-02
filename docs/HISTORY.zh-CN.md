# Graf —— 项目历史与血统

> 本文是本仓库唯一集中记录前身名称与早期实现的地方，用于追溯与署名；仓库其余文档只指向 Graf。

> 一句话：**vorniches/tapnote**（Django，MIT）→ **TeleNote**（功能 fork，Django，MIT）→
> **Graf**（本仓库：为 Cloudflare Workers/D1 用 TypeScript 重写的通用新项目）。

## 1. 最初原型：vorniches/tapnote

[vorniches/tapnote](https://github.com/vorniches/tapnote)（作者 Sérgio Vorniches，2025）是一个
受 Telegra.ph 启发的极简自托管发布平台，用 Django（Python）编写：免登录 Markdown 编辑器、
短链、一套精简的 Telegraph 风格 API。MIT 许可（© 2025 Sergei Vorniches）。本仓库以
`legacy-django` tag 完整保留了它的全部提交历史。

## 2. TeleNote —— fork 及其增量

TeleNote 是作者 redtidev1918 对 tapnote 的 fork。fork 保留了上游的
Django 基础，并新增：

- Telegraph API 兼容层（createAccount/createPage/editPage/getPage/getPageList/getViews 等）
  及 Node <-> Markdown 转换（tapnote/telegraph.py）；
- Markdown 优先的编辑器页面：8 位短链、Open Graph/社交预览卡片；
- 可选的**段落级评论系统**（ParaNote 协议：服务端端点 + 由 ParaNote fork 引入的
  static/js/paranote.js 前端），含点赞、按作者删除、用户封禁；
- 管理工具（Django admin、JSON 导入导出、PythonAnywhere 自动续期脚本、CI）。

TeleNote 对外公开时即声明为 vorniches/tapnote 的 fork 并致谢原项目；两者在代码层面已完全
分化，仅以许可历史相连。

## 3. Graf —— 为什么重写为 Cloudflare Workers？

Graf 用 TypeScript Worker 取代 Django 后端，让服务跑在 Cloudflare 边缘、零服务器运维：

- 存储迁移到 **D1**（SQLite 兼容），表结构与旧版一一对应（accounts/pages/comments/likes/bans）；
- Django admin 换成轻量、登录保护的 **/admin**；
- PythonAnywhere/Selenium 自动续期、Docker/Python 工具链全部移除；
- **行为契约保持 1:1**，客户端无需改动：HTTP 路由、请求/响应结构、错误码、ParaNote 评论
  端点、基于 cookie 的编辑令牌、Node <-> Markdown 约定均从 TeleNote 移植（25 个单元测试锁定行为）。

### 刻意为之的差异

- **安全加固**：Markdown 中的原始 HTML 不再透传（旧 Python 渲染器会原样输出）；
  编辑 cookie 加 HttpOnly/SameSite=Lax（HTTPS 下再加 Secure）；匿名身份由 HMAC 派生
  （旧版 `md5(ip+site)` 可被反推 IP）；会话 cookie 带 HMAC 签名；默认开启 CSP 等安全头。
- **顺带修复**：getPage 现在返回真实 views 计数；链接处理改为正确的 URL 解析；
  导入逐条校验而不再整体崩溃。
- **保留的行为**：8 位短链、edit_token cookie、HTML 访问计数、createPage 返回 can_edit、
  content 支持 JSON 数组或字符串、return_content、paranote.js 需要的评论 API 结构、
  每分钟评论/点赞限流。

## 4. 数据与迁移

备份为 JSON。旧 Django 导出（pages 数组：hashcode/content/title/author/...）可用
scripts/convert-django-backup.mjs 转换后经新 /admin 导入 —— 见
docs/DEPLOYMENT.zh-CN.md 第 9 节。

## 5. 命名

项目定名 **Graf**：telegraph 去掉 tele（另在多种语言中意为“段落”）——既呼应 Telegraph
兼容 API，也致敬 tapnote/paranote 的段落评论血统。作为中立的代号，品牌字符串集中在
src/config.ts（SITE_NAME）与 wrangler.toml（name），改名只动两处。

## 6. 法律

- Graf 的代码是全新的 TypeScript 实现（未再分发 Python/Django 代码）。
- 仓库内 assets/js/paranote.js 来自 ParaNote 评论项目（kkty/paranote 家族，MIT，
  经 TeleNote 时期 fork 引入），详见 THIRD_PARTY_NOTICES.zh-CN.md。
- 本仓库保留 tapnote 与 TeleNote 的完整历史（tag/branch `legacy-django`），
  使原 MIT 作品及其作者可追溯。
- 许可：MIT。版权行同时保留 Sergei Vorniches（原始 tapnote）与 redtidev1918
  （TeleNote fork 与 Graf 重写）。

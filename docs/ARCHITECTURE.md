# 架构说明（中文）

Graf 是单个 Cloudflare Worker（TypeScript）+ 一个 D1 数据库 + 一组静态资源。

```text
request ──► src/index.ts（路由 + 安全响应头 + 静态资源透传）
                  │
                  ├─ src/telegraph.ts  ── Telegraph 兼容 API（/createPage、/getPage、…）
                  ├─ src/comments.ts   ── ParaNote API（/api/v1/comments、like、ban）
                  ├─ src/web.ts        ── HTML 页面（编辑器、查看、编辑）
                  ├─ src/admin.ts      ── /admin（登录、管理、导出/导入）
                  ├─ src/markdown/*    ── 渲染（markdown-it，净化）与 Node <-> Markdown 转换
                  ├─ src/db.ts         ── 全部 SQL（accounts/pages/comments/likes/bans）
                  └─ src/{config,ids,util,auth}.ts
assets/ ── css、js（editor、site、vendor 的 paranote.js）、favicon、robots.txt
migrations/0001_init.sql ── D1 表结构
```

## 存储（D1）

页面正文以 **Markdown** 存储。Telegraph 客户端发送 nodes，
写时转 Markdown、读时（return_content=true）转回 nodes。评论以
(site_id, work_id, chapter_id, created_at) 索引平铺存储；点赞独立建表并使用部分唯一索引
（comment_id + user_id/ip），保证每个访客每条评论只能赞一次。

## 渲染管线

1. markdown-it 渲染正文（html:false —— 原始 HTML 一律转义，绝不输出）；
2. 删除线归一为 <del>（与 Django 时代输出一致）；
3. 独立的 YouTube 链接经校验替换为 <iframe> 嵌入；
4. 外链 <a> 按页面 link_target 设置 target/rel。

输出放入服务端渲染的模板；前端不依赖任何框架。

## 身份与权限

- 页面编辑：edit_token（32 位 hex）。发布后以 HttpOnly/SameSite cookie 下发，
  亦可通过 ?token=（“编辑链接备份”）使用。
- Telegraph 账号：access_token（64 位 hex）与页面绑定。
- 管理员：由环境变量配置用户名/密码；会话为 HMAC 签名 cookie，有效期 7 天。
- 评论访客：HMAC(SECRET, site+IP) 伪名 —— 同一访客稳定且不可反推 IP。

## 缓存

默认关闭（CACHE_TTL=0）。开启后匿名页面浏览会被缓存，缓存键包含页面 updated_at，
编辑后自动失效；持有编辑令牌的请求始终绕过缓存。

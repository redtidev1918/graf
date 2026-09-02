# Graf API 参考（中文）

Graf 实现了 [Telegra.ph API](https://telegra.ph/api) 的一个严格子集，使既有 Telegraph 客户端
可以不改动地接入自托管实例。所有端点都位于站点根路径、返回 JSON；响应恒含 `ok`，成功时
附带 `result`。

## 通用说明

- 端点同时接受 **JSON body** 与 **application/x-www-form-urlencoded** 表单 POST。
- `getPage` / `getViews` 也接受 GET（path 可放 URL 或 `path` 参数）。
- content 以 Telegraph *nodes* 数组传入：写入时转成 Markdown 存储，
  请求 `return_content=true` 时读回为 nodes。
- 错误返回 `ok:false` 与 `error` 码，如 `INVALID_ACCESS_TOKEN`（401）、
  `PAGE_NOT_FOUND`（404）、`PERMISSION_DENIED`（403）或人类可读信息（400）。

## createAccount

POST /createAccount

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| short_name | String | 是 | 账号名（<= 32 字符） |
| author_name | String | 否 | 新页面的默认作者名 |
| author_url | String | 否 | 默认主页链接 |

```json
{ "ok": true, "result": {
    "short_name": "Sandbox", "author_name": "Anonymous", "author_url": "",
    "access_token": "<64 位 hex>", "auth_url": "" } }
```

## getAccountInfo

POST /getAccountInfo —— 字段：short_name、author_name、author_url、auth_url、page_count。
`fields` 可为 JSON 数组；默认返回 short_name、author_name、author_url。

## revokeAccessToken

POST /revokeAccessToken —— 轮换 access_token 并返回新令牌。

## getPageList

POST /getPageList —— 返回 `total_count` 与 `pages`（path、url、title、description、
views、can_edit、author_name）。`offset`（>= 0）与 `limit`（1..200，默认 50）分页，新的在前。

## createPage

POST /createPage

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| access_token | String | 否 | 账号令牌；页面归属于该账号 |
| title | String | 是 | 页面标题 |
| content | Array | 是 | Node 数组，或 Node 数组的 JSON 字符串 |
| author_name | String | 否 | 覆盖账号默认作者名 |
| return_content | Boolean | 否 | 是否把 content 回显（默认 false） |

```json
{ "ok": true, "result": {
    "path": "Ab3xYz90", "url": "https://…/Ab3xYz90/",
    "title": "My Page", "description": "", "views": 0, "can_edit": true } }
```

## editPage

POST /editPage 或 POST /editPage/{path} —— 需要 `access_token`、`path`、`title`、`content`。
只有页面所属账号可以编辑。返回更新后的页面（请求 return_content 时附带 content）。

## getPage

GET/POST /getPage 或 GET/POST /getPage/{path} —— `return_content=true` 时 content 以 nodes
返回。`views` 为已存储的计数（由 HTML 页面访问累加，与 Telegra.ph 一致）。

## getViews

GET/POST /getViews 或 /getViews/{path} —— 返回 `{ "views": N }`。

## Node 格式

Node 遵循 Telegraph 语法：JSON 数组，元素含 `tag`、可选 `children` 与可选 `attrs`
（href/src）。写侧支持：p、h1-h6（读回时归一为 h3/h4）、b/strong、i/em、s/del/strike、a、
img、ul/ol/li、code、pre、br、hr、blockquote。未知标签读回时扁平化为文本。正文以 Markdown
存储，因此加粗等以 **bold** 形式往返。

## Web 端点

- GET / —— Markdown 编辑器（POST /publish 发布）。
- GET /{path}/ —— 渲染页面，含 Open Graph 标签与（可选）评论。
- GET|POST /{path}/edit —— 编辑页，由编辑令牌保护。
- /admin —— 登录保护的后台（JSON 导出/导入、评论管理、封禁）。

## 评论端点（ParaNote 兼容）

内置 paranote.js 即调用以下端点；其他客户端也可使用：

- GET /api/v1/comments?siteId=…&workId=…&chapterId=… —— `{ commentsByPara: { [paraIndex]: [comment…] } }`
- POST /api/v1/comments —— body：siteId、workId、chapterId、paraIndex、content、contextText（可选），成功 201。
- DELETE /api/v1/comments —— body：commentId（可带 siteId/workId/chapterId 校验归属，作者可带 editToken）。
- POST /api/v1/comments/like —— body：siteId、commentId（可带 workId/chapterId）；每个访客对每条评论幂等。
- GET/POST/DELETE /api/v1/ban?siteId=… —— 仅管理员；查询/添加/解除封禁。

评论身份：匿名访客按 (site, IP) 由 HMAC(SECRET) 摘要标识，显示为 Guest-xxxxxx；删除页面会
级联删除其评论；评论与点赞端点按 IP/分钟限流。

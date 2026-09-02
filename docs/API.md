# Graf API Reference

Graf implements a strict subset of the [Telegra.ph API](https://telegra.ph/api) so that existing
Telegraph clients work against a self-hosted instance unchanged. Every endpoint is served from
the site root and answers JSON; the response always carries `ok` and, on success, `result`.

## Common notes

- Endpoints accept **both** `application/json` bodies and `application/x-www-form-urlencoded` POSTs.
- `getPage` and `getViews` also accept GET (path either in the URL or in the `path` parameter).
- Content is passed as an array of Telegraph *nodes*; it is converted to Markdown for storage and
  back to nodes on `return_content=true`.
- Errors return `ok:false` with an `error` code such as `INVALID_ACCESS_TOKEN` (401),
  `PAGE_NOT_FOUND` (404), `PERMISSION_DENIED` (403) or a human message (400).

## createAccount

POST /createAccount

| Field | Type | Required | Description |
|---|---|---|---|
| short_name | String | yes | Account name (<= 32 chars) |
| author_name | String | no | Default author used for new pages |
| author_url | String | no | Default profile link |

```json
{ "ok": true, "result": {
    "short_name": "Sandbox", "author_name": "Anonymous", "author_url": "",
    "access_token": "<64 hex>", "auth_url": "" } }
```

## getAccountInfo

POST /getAccountInfo — fields: short_name, author_name, author_url, auth_url, page_count.
`fields` may be a JSON array. Default: short_name, author_name, author_url.

## revokeAccessToken

POST /revokeAccessToken — rotates the access token and returns the new one.

## getPageList

POST /getPageList — returns `total_count` and `pages` (path, url, title, description,
views, can_edit, author_name). `offset` (>= 0) and `limit` (1..200, default 50) paginate,
newest first.

## createPage

POST /createPage

| Field | Type | Required | Description |
|---|---|---|---|
| access_token | String | no | Account token; the page is attributed to it |
| title | String | yes | Page title |
| content | Array | yes | Node array or JSON string of nodes |
| author_name | String | no | Overrides the account default |
| return_content | Boolean | no | Echo the content back (default false) |

```json
{ "ok": true, "result": {
    "path": "Ab3xYz90", "url": "https://…/Ab3xYz90/",
    "title": "My Page", "description": "", "views": 0, "can_edit": true } }
```

## editPage

POST /editPage or POST /editPage/{path} — requires `access_token`, `path`, `title`, `content`.
Only the owning account may edit. Returns the updated page (plus `content` when asked).

## getPage

GET/POST /getPage or GET/POST /getPage/{path} — `return_content=true` adds `content` as nodes.
`views` is the stored counter (incremented by HTML page views, same as Telegra.ph).

## getViews

GET/POST /getViews or /getViews/{path} — returns `{ "views": N }`.

## Node format

Nodes follow the Telegraph grammar: a JSON array of elements with `tag`, optional `children`,
and optional `attrs` (href/src). Supported on the way in: p, h1-h6 (normalised to h3/h4 when
read back), b/strong, i/em, s/del/strike, a, img, ul/ol/li, code, pre, br, hr, blockquote.
Unknown tags are flattened to their text on read-back. Content is stored as Markdown, so
bold round-trips as **bold**, etc.

## Web endpoints

- GET / — Markdown editor (publishes at POST /publish).
- GET /{path}/ — rendered page with Open Graph tags and (optionally) comments.
- GET|POST /{path}/edit — edit page, guarded by the edit token.
- /admin — login-gated dashboard (export/import JSON, moderation, bans).

## Comment endpoints (ParaNote compatible)

Bundled paranote.js speaks to these; they are also usable by other clients:

- GET /api/v1/comments?siteId=…&workId=…&chapterId=… — `{ commentsByPara: { [paraIndex]: [comment…] } }`
- POST /api/v1/comments — body: siteId, workId, chapterId, paraIndex, content, contextText (optional). 201 on success.
- DELETE /api/v1/comments — body: commentId (+siteId/workId/chapterId to verify ownership, editToken for author rights).
- POST /api/v1/comments/like — body: siteId, commentId (+workId/chapterId). Idempotent per visitor.
- GET/POST/DELETE /api/v1/ban?siteId=… — admin only; list/add/remove bans.

Comment identity: anonymous visitors are identified per (site, IP) by an HMAC(SECRET) digest,
shown as Guest-xxxxxx; deleting a page removes its comments; comment and like endpoints are
rate-limited per IP/minute.


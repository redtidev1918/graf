# Architecture

Graf is a single Cloudflare Worker (TypeScript) with a D1 database and static assets.

```text
request ──► src/index.ts (router + security headers + static-asset passthrough)
                  │
                  ├─ src/telegraph.ts  ── Telegraph-compatible API (/createPage, /getPage, …)
                  ├─ src/comments.ts   ── ParaNote API (/api/v1/comments, like, ban)
                  ├─ src/web.ts        ── HTML pages (editor, view, edit)
                  ├─ src/admin.ts      ── /admin (login, moderation, export/import)
                  ├─ src/markdown/*    ── render (markdown-it, sanitising) & Node<->Markdown
                  ├─ src/db.ts         ── all SQL over D1 (accounts/pages/comments/likes/bans)
                  └─ src/{config,ids,util,auth}.ts
assets/ ── css, js (editor, site, vendored paranote.js), favicon, robots.txt
migrations/0001_init.sql ── D1 schema
```

## Storage (D1)

Pages store body text as **Markdown** (as in the legacy Django version of TeleNote). Telegraph clients send nodes,
which are converted to Markdown on write and back to nodes on read (`return_content=true`).
Comments are stored flat with a (site_id, work_id, chapter_id, created_at) index; likes are a
separate table with partial unique indexes (comment_id + user_id/ip) so a visitor can like once.

## Rendering pipeline

1. markdown-it renders the body (`html:false` — raw HTML is escaped, never emitted);
2. strikethrough is normalised to `<del>` (Django-era parity);
3. standalone YouTube links are replaced by validated `<iframe>` embeds;
4. external `<a>` tags get `target`/`rel` attributes per page `link_target`.

Output is then placed in a server-rendered template; no client-side framework is used.

## Identity & permissions

- Page editing: `edit_token` (32 hex), delivered as HttpOnly/SameSite cookie after publishing,
  also usable via `?token=` (a “backup edit link”).
- Telegraph accounts: `access_token` (64 hex) bound to pages.
- Admin: env-configured username/password; session = HMAC-signed cookie, 7 days.
- Comment visitors: HMAC(SECRET, site+IP) pseudonym — stable per visitor, not reversible to IP.

## Caching

Off by default (`CACHE_TTL=0`). When enabled, anonymous page views are cached with a cache key
that includes the page `updated_at`, so edits invalidate automatically; edit-token holders always
bypass the cache.

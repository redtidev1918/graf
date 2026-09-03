# Changelog

## [1.2.0] - 2026-09-03

### Added

- Download a single page as Markdown (`/{path}/download`) and a whole book as TXT (`/book/{slug}/download`).
- Editor author tools: draft autosave (localStorage, publish page) + live word count.

## [1.1.0] - 2026-09-03

### Added

- Novel mode (BOOKS_ENABLED): books + book_id/order_num on pages (migration 0003), /books and
  /book/{id} catalogs, prev/next chapter navigation, admin Books management; backups carry book metadata.
- UI now defaults to Simplified Chinese.

### Fixed

- D1 batch protocol on production (prepared statements) — found by remote deployment testing.
- CI matrix runs on Node 22/24 (integration tests need node:sqlite).

## [1.0.1] - 2026-09-03

Stabilization pass: data-integrity, security and contract hardening on the existing
architecture (no refactor). Tests grew from 25 to 88 (SQLite-backed route-level tests).

### Fixed

- Page deletion no longer leaves orphan comments/likes (atomic cleanup order).
- Comment deletion removes its likes atomically.
- Backups: validated schema, atomic batch import, idempotent pages/comments, no raw IPs
  or access tokens exported, credential warning shown on /admin.
- Edit-token flow: ?token= now 303s to the clean URL after granting the cookie; GET on the
  edit page persists the cookie so form POST works; token no longer lingers in URLs.
- Admin: open-redirect fixed (login next allowlist), CSRF origin guard for cookie-authenticated
  mutations, lightweight login brute-force throttle, pagination for pages/comments lists.
- SECRET is now enforced when comments/admin are enabled (fail-fast misconfiguration page).
- HEAD requests mirror GET without mutating views; HTML GET is the only view counter.
- Telegraph API input validation: title/author limits, node depth/count limits, oversized JSON.
- deploy.mjs --dry-run no longer requires Cloudflare credentials.

### Added

- Contract tests for Telegraph API (21) and ParaNote (10); integration tests for admin (13),
  web flows (13), data integrity, config semantics and backup round-trip (SQLite adapter).
- Migration 0002: comment dedupe index for idempotent imports.
- Env knobs: COMMENT_RATE_LIMIT, LIKE_RATE_LIMIT.

All notable changes to **Graf** are documented here. The project follows semantic versioning;
releases are tagged `vX.Y.Z` in this repository.

## [1.0.0] - 2026-09-03

First release. Graf is the Cloudflare Workers/D1 implementation of the publishing platform
(the project's lineage is documented in docs/HISTORY.md).

### Added

- Telegraph-compatible API: `createAccount`, `getAccountInfo`, `revokeAccessToken`, `createPage`, `editPage`, `getPage`, `getPageList`, `getViews` (JSON or form-encoded bodies; GET support on `getPage`/`getViews`).
- Markdown publishing: anonymous editor, 8-char short URLs, Open Graph / Twitter cards, `<del>` strikethrough, footnotes, fenced code, tables, YouTube embeds.
- ParaNote-compatible comments: per-paragraph sidebar UI (`assets/js/paranote.js`), like system with per-visitor uniqueness, author delete rights, admin bans; endpoints `/api/v1/comments`, `/api/v1/comments/like`, `/api/v1/ban`.
- Admin area `/admin`: HMAC-signed session login, dashboard, page/comment moderation, ban management, JSON export/import.
- Storage on Cloudflare D1 (`migrations/0001_init.sql`); optional edge HTML cache via `CACHE_TTL`.
- Tooling: `wrangler` v4 workflow, vitest suite (unit tests for nodes/render/ids/util), `tsc --noEmit` clean, GitHub Actions CI (typecheck + tests), cross-platform auto-deploy CLI `scripts/deploy.mjs` (install bootstrap `scripts/install.mjs`), Django-backup converter `scripts/convert-django-backup.mjs`.
- Documentation: README (EN/zh-CN), API / Deployment / Architecture / Origin docs, MIT license with upstream attribution, third-party notices.

### Security

- Raw HTML in Markdown is never passed through (removes the stored-XSS vector of the Django renderer); strict CSP and other hardening headers; `HttpOnly`/`SameSite` cookies; HMAC-derived anonymous comment identities (previous `md5(ip+site)` hashes were reversible); signed admin session cookies; per-IP comment/like rate limits; validated YouTube embeds only.

### Fixed vs. the Django codebase

- `getPage` returned a hard-coded view count of 0 — now reports the stored counter.
- Data import validates every row instead of crashing on malformed backups.
- Link handling rewritten with proper URL parsing (no attribute-injection via crafted hrefs).

### Removed (by design)

- Python/Django runtime, Docker/PythonAnywhere deployment tooling and Selenium renewal scripts.
- Django admin (replaced by the minimal built-in `/admin`).
- Pass-through of raw HTML/iframes in page bodies.

### Legacy

- The previous Django-era codebase is preserved at tag and branch `legacy-django` (see docs/HISTORY.md).


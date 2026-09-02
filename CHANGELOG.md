# Changelog

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
- Tooling: `wrangler` v4 workflow, vitest suite (unit tests for nodes/render/ids/util), `tsc --noEmit` clean, GitHub Actions CI (typecheck + tests), one-shot deploy helper `scripts/deploy-cf.sh`, Django-backup converter `scripts/convert-django-backup.mjs`.
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


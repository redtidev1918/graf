# Changelog

## Unreleased

- grafctl 0.4.2: workers.dev enable now uses POST (PUT returned 405 "Method not allowed for this authentication scheme"); self-check no longer misreports "network failure" when the local network simply cannot reach worker.dev directly.
- grafctl 0.4.1: D1 migrations + Worker bundle embedded into the binary (truly single-file; no repo checkout/Node/npm needed); `--help`/`--version` no longer trigger a deploy; embedded bundle is the default, `GRAF_BUNDLE` overrides.
- grafctl 0.3.0: token persistence (`auth`), auto-enable worker.dev, color-coded logging + `--no-color`, one-line installers (sh + PowerShell `irm | iex`), per-platform release binaries.

## [1.1.1](https://github.com/redtidev1918/graf/compare/v1.1.0...v1.1.1) (2026-09-08)


### Bug Fixes

* **release:** create grafctl component tag before goreleaser ([4c2504e](https://github.com/redtidev1918/graf/commit/4c2504e396a4e5475e69ac2e64139feacc47e57f))
* **release:** create grafctl tag via git push (gh refs API 404s) ([32cc5c1](https://github.com/redtidev1918/graf/commit/32cc5c141e8c9967b40bb8cc0f175b7f7fb9d7bd))
* **release:** use semver suffix tag vX.Y.Z-grafctl for grafctl ([a218d7c](https://github.com/redtidev1918/graf/commit/a218d7c46ef5a22ced7074be656ead18fda477cc))

## [1.1.0](https://github.com/redtidev1918/graf/compare/v1.0.0...v1.1.0) (2026-09-07)


### Features

* **deploy:** foolproof one-command auto-deploy tooling ([b392420](https://github.com/redtidev1918/graf/commit/b39242000c3c0662f34b4404929a590639f8add2))
* **deploy:** robust cross-platform Node CLI deployer (replaces bash scripts) ([753e7a7](https://github.com/redtidev1918/graf/commit/753e7a788d299c6f5bd1b4e7c2e5c1148f25e817))
* **docker:** 一键 Docker 自托管(无需 Node) — Dockerfile/compose/entrypoint + docker-up.sh + 文档 ([61a1c6b](https://github.com/redtidev1918/graf/commit/61a1c6b4410cd0334b4796672605295eb4b7a69c))
* **go:** grafctl 跨平台部署器(API 直连) + 单文件 bundle + 分平台发版 + Docker ([cb07206](https://github.com/redtidev1918/graf/commit/cb07206082c7821c56da90c53456772ffeb50a41))
* **grafctl:** auth 持久化 Token + 一键安装脚本 — 零依赖傻瓜式部署 ([a4d355c](https://github.com/redtidev1918/graf/commit/a4d355c8b793d14a5eebc6d69c0dd12ecf010be1))
* **grafctl:** deploy 自动开启 worker.dev(subdomain enabled) + doctor 显示状态 ([bbf648c](https://github.com/redtidev1918/graf/commit/bbf648c6da40096c68191b78a42ef6921f8826fc))
* **grafctl:** Windows irm|iex 一键安装 + 彩色日志(doctor 自检, --no-color) ([546519d](https://github.com/redtidev1918/graf/commit/546519d27dc6273f71442d5314ad949775ee768b))
* **grafctl:** 内嵌 D1 迁移 + Worker bundle，真正单文件零依赖 (v0.4.0) ([fed0fca](https://github.com/redtidev1918/graf/commit/fed0fcaba721984ac3e505808f33f55774f255e1))
* **novel:** 小说模式 v1.1.0 — books/章节目录/上下页导航 + 后台作品管理 + 备份兼容 + 中文UI ([d339a27](https://github.com/redtidev1918/graf/commit/d339a2767689a41936923ad3dcbc5eb076397440))
* **ui:** 界面默认简体中文 — 统一编辑器/查看页/404/后台文案（评论前端 paranote.js 本就为中文） ([a0c44db](https://github.com/redtidev1918/graf/commit/a0c44db6a85eb128316b056ea205f9fae982e615))
* **ux:** v1.2.0 — 单篇/整本下载(Markdown/TXT)、编辑器草稿自动保存+字数统计 ([b20d5ea](https://github.com/redtidev1918/graf/commit/b20d5ead1d3b15961ae1f44da3a898084b1aa00c))


### Bug Fixes

* batchExec must pass prepared statements to real D1 batch() (not raw {sql,params}); adapter aligned — delete page/comment and atomic import now work on production D1 ([30511ae](https://github.com/redtidev1918/graf/commit/30511ae112db2d1de362756340ce4e77272ff25a))
* **grafctl:** --help/--version 不再误触发部署 (v0.4.1) ([1cf7588](https://github.com/redtidev1918/graf/commit/1cf75881da95ad69851eb8b691deaecd3350d5c2))
* **grafctl:** API 直传实测修正 — vars 用 plain_text、D1 绑定用 type d1+database_id、模块 part 加 application/javascript+module、metadata workers_dev ([4151bd7](https://github.com/redtidev1918/graf/commit/4151bd748c26e74d3780245158bacddbff4d3994))
* **grafctl:** worker.dev 开启改用 POST(修复 405) + 自检不再误报网络失败 (v0.4.2) ([9859b27](https://github.com/redtidev1918/graf/commit/9859b27353a391e20f6a5547a9f5e2c23e6ec95c))
* **grafctl:** 安装器只取 -grafctl tag + 自动写 PATH 到 shell 配置(消除 command not found) ([ec5f16a](https://github.com/redtidev1918/graf/commit/ec5f16a56985cffe6d2e5011de91bd99b62e9b12))

## [1.3.0] - 2026-09-04

### Added

- Static assets are embedded into the single-file worker bundle (deployable without the assets binding).
- `grafctl` — cross-platform Go deployer (direct Cloudflare API, no Node): doctor / migrate / deploy with --yes/--dry-run; per-platform binaries released on `v*-grafctl` tags via goreleaser.
- Docker one-command self-host (no Node on the host).

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

# Changelog

## Unreleased

- grafctl 0.4.2: workers.dev enable now uses POST (PUT returned 405 "Method not allowed for this authentication scheme"); self-check no longer misreports "network failure" when the local network simply cannot reach worker.dev directly.
- grafctl 0.4.1: D1 migrations + Worker bundle embedded into the binary (truly single-file; no repo checkout/Node/npm needed); `--help`/`--version` no longer trigger a deploy; embedded bundle is the default, `GRAF_BUNDLE` overrides.
- grafctl 0.3.0: token persistence (`auth`), auto-enable worker.dev, color-coded logging + `--no-color`, one-line installers (sh + PowerShell `irm | iex`), per-platform release binaries.

## [1.2.0](https://github.com/redtidev1918/graf/compare/v1.1.1...v1.2.0) (2026-09-08)


### Features

* Add data migration and initial admin setup features ([f1fe2f4](https://github.com/redtidev1918/graf/commit/f1fe2f4dc50178315b90f14294bb173a561bf21e))
* Add og:image support for social preview ([2c6ad2a](https://github.com/redtidev1918/graf/commit/2c6ad2af8d413849cf85da2087cd263823705f5d))
* add pythonanywhere auto-renewal script and workflow ([5c556ed](https://github.com/redtidev1918/graf/commit/5c556edcbcd05c2a47014b92c4d6a6b5e4205379))
* add scheduled tasks renewal to renew_pa.py ([f6dc80f](https://github.com/redtidev1918/graf/commit/f6dc80f7a4de0e34b55a5e8618792efa63496183))
* add tests, deployment config, and Chinese README; fix scrolling and csrf issues ([9d9fed8](https://github.com/redtidev1918/graf/commit/9d9fed83771084207c3bf2fdcbc915e70fd7347c))
* Add Title/Author, Open Graph tags, and sync Paranote fix ([8fd0bff](https://github.com/redtidev1918/graf/commit/8fd0bff92511667187ba8abbad1ae369977f96f6))
* add txt2tapnote script utility ([3c2e9cb](https://github.com/redtidev1918/graf/commit/3c2e9cbea1f46b7cb1aa641287f55a7df4cfd218))
* allow users to configure link target (new tab vs same tab) ([3cc890e](https://github.com/redtidev1918/graf/commit/3cc890edaba201442472243952e8a9960a817cc3))
* **deploy:** foolproof one-command auto-deploy tooling ([b392420](https://github.com/redtidev1918/graf/commit/b39242000c3c0662f34b4404929a590639f8add2))
* **deploy:** robust cross-platform Node CLI deployer (replaces bash scripts) ([753e7a7](https://github.com/redtidev1918/graf/commit/753e7a788d299c6f5bd1b4e7c2e5c1148f25e817))
* **docker:** 一键 Docker 自托管(无需 Node) — Dockerfile/compose/entrypoint + docker-up.sh + 文档 ([61a1c6b](https://github.com/redtidev1918/graf/commit/61a1c6b4410cd0334b4796672605295eb4b7a69c))
* Enhance edit permission robustness (backup link & auto-cookie refresh) ([3251b36](https://github.com/redtidev1918/graf/commit/3251b3655a4d7b86ce7e295118aa6d93332ae144))
* enhance pythonanywhere renewal script with proxy support and robust driver loading ([e212385](https://github.com/redtidev1918/graf/commit/e2123854ef1ac3e2d61b66395b9624f95ac11b9c))
* **go:** grafctl 跨平台部署器(API 直连) + 单文件 bundle + 分平台发版 + Docker ([cb07206](https://github.com/redtidev1918/graf/commit/cb07206082c7821c56da90c53456772ffeb50a41))
* **grafctl:** auth 持久化 Token + 一键安装脚本 — 零依赖傻瓜式部署 ([a4d355c](https://github.com/redtidev1918/graf/commit/a4d355c8b793d14a5eebc6d69c0dd12ecf010be1))
* **grafctl:** deploy 自动开启 worker.dev(subdomain enabled) + doctor 显示状态 ([bbf648c](https://github.com/redtidev1918/graf/commit/bbf648c6da40096c68191b78a42ef6921f8826fc))
* **grafctl:** Windows irm|iex 一键安装 + 彩色日志(doctor 自检, --no-color) ([546519d](https://github.com/redtidev1918/graf/commit/546519d27dc6273f71442d5314ad949775ee768b))
* **grafctl:** 内嵌 D1 迁移 + Worker bundle，真正单文件零依赖 (v0.4.0) ([fed0fca](https://github.com/redtidev1918/graf/commit/fed0fcaba721984ac3e505808f33f55774f255e1))
* implement Telegraph-compatible API and optional comment system ([4819e35](https://github.com/redtidev1918/graf/commit/4819e3578add47c137ad7b2c6e5f56af0f6448de))
* integrate paranote comments ([b8c31fe](https://github.com/redtidev1918/graf/commit/b8c31fe7728ff7bcedee6cf443265f1486f52e8a))
* **novel:** 小说模式 v1.1.0 — books/章节目录/上下页导航 + 后台作品管理 + 备份兼容 + 中文UI ([d339a27](https://github.com/redtidev1918/graf/commit/d339a2767689a41936923ad3dcbc5eb076397440))
* Optimize URL to short 8-char ID and update docs ([5120964](https://github.com/redtidev1918/graf/commit/5120964ff5c44daa14a7d9b62aaf9f8b32e63d00))
* remove unused AI module, add robustness checks, update docs ([13f4957](https://github.com/redtidev1918/graf/commit/13f495796b90c96c891bab0420e8267bfd7f5cf6))
* rewrite TeleNote as Graf — Telegraph-compatible publishing on Cloudflare Workers/D1 ([923990a](https://github.com/redtidev1918/graf/commit/923990acb8653fd9595677431bc76fd2d69f2a22))
* support reading credentials from config file ([e8f5bdf](https://github.com/redtidev1918/graf/commit/e8f5bdfe579ff82c59d36041f2b8b1fab6363b12))
* **ui:** 界面默认简体中文 — 统一编辑器/查看页/404/后台文案（评论前端 paranote.js 本就为中文） ([a0c44db](https://github.com/redtidev1918/graf/commit/a0c44db6a85eb128316b056ea205f9fae982e615))
* **ux:** v1.2.0 — 单篇/整本下载(Markdown/TXT)、编辑器草稿自动保存+字数统计 ([b20d5ea](https://github.com/redtidev1918/graf/commit/b20d5ead1d3b15961ae1f44da3a898084b1aa00c))
* 允许文章作者删除评论 ([84414cb](https://github.com/redtidev1918/graf/commit/84414cb11c8370eb739192ed7d29965995e2677e))


### Bug Fixes

* add Alpine Linux paths for chromium/chromedriver ([fdda027](https://github.com/redtidev1918/graf/commit/fdda027bcf1f9369684d87631f308afb8b5b9589))
* add multiple fallback methods for chromedriver on Linux ([b061dd5](https://github.com/redtidev1918/graf/commit/b061dd5ce0d5c5fd586c352fa2bc3f1ab24a8b6a))
* allow authors to ban users, not just admins ([50ef90b](https://github.com/redtidev1918/graf/commit/50ef90bd1285c21bdbfca119fe2495032c1440dc))
* batchExec must pass prepared statements to real D1 batch() (not raw {sql,params}); adapter aligned — delete page/comment and atomic import now work on production D1 ([30511ae](https://github.com/redtidev1918/graf/commit/30511ae112db2d1de362756340ce4e77272ff25a))
* Correct template inheritance paths from 'TeleNote/' to 'tapnote/' ([57ec975](https://github.com/redtidev1918/graf/commit/57ec975326517b0933b4b7c7394ea7d4c9180fbe))
* **grafctl:** --help/--version 不再误触发部署 (v0.4.1) ([1cf7588](https://github.com/redtidev1918/graf/commit/1cf75881da95ad69851eb8b691deaecd3350d5c2))
* **grafctl:** API 直传实测修正 — vars 用 plain_text、D1 绑定用 type d1+database_id、模块 part 加 application/javascript+module、metadata workers_dev ([4151bd7](https://github.com/redtidev1918/graf/commit/4151bd748c26e74d3780245158bacddbff4d3994))
* **grafctl:** worker.dev 开启改用 POST(修复 405) + 自检不再误报网络失败 (v0.4.2) ([9859b27](https://github.com/redtidev1918/graf/commit/9859b27353a391e20f6a5547a9f5e2c23e6ec95c))
* **grafctl:** 安装器只取 -grafctl tag + 自动写 PATH 到 shell 配置(消除 command not found) ([ec5f16a](https://github.com/redtidev1918/graf/commit/ec5f16a56985cffe6d2e5011de91bd99b62e9b12))
* improve renewal script logging for non-json success responses ([21aa865](https://github.com/redtidev1918/graf/commit/21aa8657c76f44d6c43f6a68db6c61618ec743e8))
* install webdriver-manager in gh-actions to resolve driver version mismatch ([6b0249d](https://github.com/redtidev1918/graf/commit/6b0249db844699b936022454a19676f5cbd3aab9))
* make pyyaml dependency optional for env-var based runs ([0c2f86d](https://github.com/redtidev1918/graf/commit/0c2f86d7311745537d1e4ffe2dccfd6e7bee2e9c))
* Prevent body scroll when sidebar is open on mobile ([95b6f9a](https://github.com/redtidev1918/graf/commit/95b6f9a51de8e670e606388b980428b5131081d2))
* prioritize links and interactive elements over comment sidebar in mobile view ([8545999](https://github.com/redtidev1918/graf/commit/8545999dd9078aa77247f210b16fabae57710bdc))
* **release:** create grafctl component tag before goreleaser ([4c2504e](https://github.com/redtidev1918/graf/commit/4c2504e396a4e5475e69ac2e64139feacc47e57f))
* **release:** create grafctl tag via git push (gh refs API 404s) ([32cc5c1](https://github.com/redtidev1918/graf/commit/32cc5c141e8c9967b40bb8cc0f175b7f7fb9d7bd))
* **release:** use semver suffix tag vX.Y.Z-grafctl for grafctl ([a218d7c](https://github.com/redtidev1918/graf/commit/a218d7c46ef5a22ced7074be656ead18fda477cc))
* Reset body overflow on close button click for mobile ([5ec203f](https://github.com/redtidev1918/graf/commit/5ec203f7e89009797b29079b67ecf26a89a68fc0))
* update tests to match current behavior ([403aed3](https://github.com/redtidev1918/graf/commit/403aed32c16466d4ba45e82170347fea12c7d363))
* use matching Chrome and ChromeDriver versions ([b97c884](https://github.com/redtidev1918/graf/commit/b97c884ef37dec89e85cbcc12d21f82aeef8bf10))
* use webdriver-manager for automatic chromedriver installation ([3400296](https://github.com/redtidev1918/graf/commit/34002966193ad0125a575d6fc1b8cabc614cfb95))
* 完成通用性改进，支持通过data属性自定义所有UI文本 ([9b788eb](https://github.com/redtidev1918/graf/commit/9b788ebb6f1ae641814665680f3334b5ac7a3edb))

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

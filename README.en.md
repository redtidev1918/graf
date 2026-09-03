
# Graf

Graf is a minimalist, **self-hosted Markdown publishing platform** that is **API-compatible with**
[Telegra.ph](https://telegra.ph) (the Telegraph API), designed to run entirely on
**Cloudflare Workers + D1**. One short URL, instant pages, optional paragraph-level comments.

Project history and lineage: [docs/HISTORY.md](docs/HISTORY.md).

## Features

- **Telegraph API compatible**: createAccount, createPage, editPage, getPage, getPageList, getViews, getAccountInfo, revokeAccessToken - drop-in for existing Telegraph clients.
- **Markdown pages**: publish instantly from the built-in editor, no account needed. Strikethrough, tables, fenced code, footnotes, YouTube embeds and Open Graph social cards included.
- **ParaNote-compatible comments**: Medium-style per-paragraph comments + likes, same API contract the bundled paranote.js client expects.
- **On the edge**: Cloudflare Workers (TypeScript) + D1 (SQLite). No VPS, no Python, no Docker. Optional HTML caching via CACHE_TTL.
- **Self-owned data**: full JSON backup/restore from /admin/export and /admin/import.
- **Minimal admin**: login-gated dashboard for page/comment moderation, bans and data export/import.
- **Safe by default**: raw HTML in Markdown never passes through (no stored XSS), anonymous comment identities are HMAC-derived, signed admin cookies, strict CSP.

## Quick start

**One-command auto deploy (recommended)** — clones, installs dependencies, checks the
Cloudflare login, creates the D1 database, writes secrets, migrates and deploys, asking only
a few questions (site name, comments on/off, admin username/password):

```bash
curl -fsSL https://raw.githubusercontent.com/redtidev1918/graf/master/scripts/install.mjs -o /tmp/graf-install.mjs && node /tmp/graf-install.mjs
```

Already cloned? Just run `node scripts/deploy.mjs` (or `npm run deploy:auto`).
To skip the questions, pre-set the variables (or add `--yes` for fully automatic mode — the admin
password is auto-generated and printed once; `--dry-run` rehearses without touching Cloudflare).
Windows is supported too — the tool is pure Node; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD='your-password' node scripts/deploy.mjs
```

### Manual step-by-step (optional)

Prerequisites: Node.js >= 18 and a Cloudflare account with the free Workers plan.

1. Clone and install:

```bash
git clone <your-repo-url> graf
cd graf
npm install
```

2. Create the D1 database and put its id into wrangler.toml:

```bash
npx wrangler d1 create graf   # prints a database_id
# paste the id into wrangler.toml -> [[d1_databases]] -> database_id
npx wrangler d1 migrations apply graf --remote
```

3. Configure secrets (never commit them):

```bash
cp .dev.vars.example .dev.vars   # fill SECRET / ADMIN_USERNAME / ADMIN_PASSWORD
npx wrangler secret put SECRET
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
```

4. Run locally or deploy:

```bash
npm run dev        # http://localhost:8787
npm run deploy     # publish to workers.dev or a custom route
```

Open the root URL, write Markdown and hit Publish. You get a short URL such as
https://your-worker.example/Ab3xYz90/. The edit_token is stored in an HttpOnly cookie;
the page also offers a Copy-edit-link to restore editing from another browser.

## Configuration

All settings are environment variables ([vars] in wrangler.toml or secrets):

| Variable | Default | Description |
|---|---|---|
| SECRET | required when comments/admin are on (both on by default) | HMAC secret for admin sessions and anonymous comment identities. Only a stripped instance (ENABLE_COMMENTS=false and no ADMIN_*) may omit it. |
| SITE_NAME | Graf | Brand shown in titles / Open Graph. |
| SITE_ID | default | Comment namespace for this site instance. |
| ENABLE_COMMENTS | true | Set false to disable the comment API and UI. |
| MAX_PAGE_LENGTH | 200000 | Max characters of a page body. |
| CACHE_TTL | 0 | Optional HTML cache TTL in seconds for anonymous readers (0 = off). |
| BOOKS_ENABLED | false | Novel mode: /books index, /book/{slug} catalogs, prev/next chapter navigation, admin Books management. |
| BASE_URL | (auto) | Public base URL used to build absolute links. |
| ADMIN_USERNAME / ADMIN_PASSWORD | (unset) | Enables /admin. |

## API compatibility

All Telegraph methods live at the site root and accept both JSON bodies and
form-encoded POSTs (GET is also accepted for getPage / getViews):

```bash
curl -X POST https://your-worker.example/createPage \
  --data-urlencode title=My-Page \
  --data-urlencode access_token=YOUR_TOKEN \
  --data-urlencode content=[{"tag":"p","children":["Hello world"]}]
```

Full reference: [docs/API.md](docs/API.md). Deployment: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
Architecture notes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Novel mode (optional)

With BOOKS_ENABLED=true, create books in the admin area and group chapter pages into them; readers get
a /books index and per-book catalogs at /book/{slug}, and chapter pages show previous/next navigation.

## Comments

When ENABLE_COMMENTS is on, published pages load assets/js/paranote.js, which renders a
comment sidebar per paragraph, supports likes, and gives authors (edit-token holders) delete
rights. Admins can ban abusive identities from /admin. The backend is ParaNote-protocol
compatible (/api/v1/comments, /api/v1/comments/like, /api/v1/ban).

## Development

```bash
npm test            # vitest unit tests
npm run typecheck   # tsc --noEmit
npm run db:migrate:local
```

## Acknowledgments

Graf builds on external projects and specifications; thanks to:

- **Sérgio Vorniches** (MIT) — author of the original publishing implementation this project's design derives from.
- **ParaNote** ([redtidev1918/paranote](https://github.com/redtidev1918/paranote)) — the author's own paragraph-comment system; source of the comment protocol and the bundled paranote.js client.
- **Telegra.ph / Telegraph API** — design reference and public API spec.
- **markdown-it / markdown-it-footnote** (MIT) — Markdown rendering engine.
- **Django / Python-Markdown** — ecosystem behind the legacy implementation.
- **Cloudflare (Workers / D1 / wrangler)** — runtime platform.

Third-party legal notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)（中文版：[THIRD_PARTY_NOTICES.zh-CN.md](THIRD_PARTY_NOTICES.zh-CN.md)）.

## References

- Telegra.ph API spec: https://telegra.ph/api
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- wrangler: https://developers.cloudflare.com/workers/wrangler/
- ParaNote (paragraph-comment protocol): https://github.com/redtidev1918/paranote
- markdown-it: https://github.com/markdown-it/markdown-it
- Python-Markdown: https://python-markdown.github.io/

> Primary documentation is in Simplified Chinese: [README.md](README.md).

## License

Licensed under the MIT License; see [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Project history and lineage: [docs/HISTORY.md](docs/HISTORY.md).
Change history: [CHANGELOG.md](CHANGELOG.md).

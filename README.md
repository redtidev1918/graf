# Graf

Graf is a minimalist, **self-hosted Markdown publishing platform** that is **API-compatible with**
[Telegra.ph](https://telegra.ph) (the Telegraph API), designed to run entirely on
**Cloudflare Workers + D1**. One short URL, instant pages, optional paragraph-level comments.

It is the Cloudflare Workers successor of the Django project *TeleNote*, which itself was a fork
of [vorniches/tapnote](https://github.com/vorniches/tapnote). See [docs/ORIGIN.md](docs/ORIGIN.md)
for the full history and the legal/attribution details.

## Features

- **Telegraph API compatible**: createAccount, createPage, editPage, getPage, getPageList, getViews, getAccountInfo, revokeAccessToken - drop-in for existing Telegraph clients.
- **Markdown pages**: publish instantly from the built-in editor, no account needed. Strikethrough, tables, fenced code, footnotes, YouTube embeds and Open Graph social cards included.
- **ParaNote-compatible comments**: Medium-style per-paragraph comments + likes, same API contract the bundled paranote.js client expects.
- **On the edge**: Cloudflare Workers (TypeScript) + D1 (SQLite). No VPS, no Python, no Docker. Optional HTML caching via CACHE_TTL.
- **Self-owned data**: full JSON backup/restore from /admin/export and /admin/import.
- **Minimal admin**: login-gated dashboard for page/comment moderation, bans and data export/import.
- **Safe by default**: raw HTML in Markdown never passes through (no stored XSS), anonymous comment identities are HMAC-derived, signed admin cookies, strict CSP.

## Quick start

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
| SECRET | (required) | HMAC secret for admin sessions and anonymous comment identities. |
| SITE_NAME | Graf | Brand shown in titles / Open Graph. |
| SITE_ID | default | Comment namespace for this site instance. |
| ENABLE_COMMENTS | true | Set false to disable the comment API and UI. |
| MAX_PAGE_LENGTH | 200000 | Max characters of a page body. |
| CACHE_TTL | 0 | Optional HTML cache TTL in seconds for anonymous readers (0 = off). |
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

## Comments

When ENABLE_COMMENTS is on, published pages load assets/js/paranote.js, which renders a
comment sidebar per paragraph, supports likes, and gives authors (edit-token holders) delete
rights. Admins can ban abusive identities from /admin. The backend is ParaNote-protocol
compatible (/api/v1/comments, /api/v1/comments/like, /api/v1/ban).

## One-shot deploy

Logged into Cloudflare already? Set your admin credentials and run the helper (it creates the
D1 database, fills in `wrangler.toml`, pushes secrets, migrates and deploys):

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD='your-password' ./scripts/deploy-cf.sh
```

## Development

```bash
npm test            # vitest unit tests
npm run typecheck   # tsc --noEmit
npm run db:migrate:local
```

## Origins and license

- vorniches/tapnote - original Django project (MIT, (c) 2025 Sergei Vorniches).
- TeleNote (zoidberg-xgd -> redtidev1918) - feature fork of tapnote (comments, Telegraph API, editor, ban system, tools).
- Graf - 2026 TypeScript rewrite of TeleNote for Cloudflare Workers/D1.

History, behavior deltas and attribution: [docs/ORIGIN.md](docs/ORIGIN.md).
Change history: [CHANGELOG.md](CHANGELOG.md).
Licensed under the MIT License; see [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

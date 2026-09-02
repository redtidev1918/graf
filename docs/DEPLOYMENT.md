# Deployment Guide

## 1. Prerequisites

- Node.js >= 18, npm.
- Cloudflare account (Workers free plan is fine; D1 free tier included).
- For a custom domain: a zone on Cloudflare (see section 6).

## 2. Fastest path: one-command auto deploy (recommended)

On a machine that does not have the repository yet, paste this single line (it clones the repo,
installs dependencies, checks the Cloudflare login, creates the D1 database, writes secrets,
migrates, deploys and runs an online self-check):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/redtidev1918/graf/master/scripts/install.sh)
```

Already cloned? Run:

```bash
./scripts/deploy-cf.sh      # or: npm run deploy:auto
```

The script asks only: site name (default Graf), whether to enable comments, and the admin
username/password (hidden input, double confirmation). To skip the questions pre-set the
variables (`ADMIN_USERNAME`, `ADMIN_PASSWORD`); SECRET is auto-generated. The script is
idempotent — re-run it to redeploy.

## 3. Local development

```bash
npm install
cp .dev.vars.example .dev.vars        # fill SECRET etc. (gitignored)
npx wrangler d1 migrations apply graf --local
npm run dev                           # http://localhost:8787
```

Local D1 data lives in `.wrangler/state` (gitignored).

## 4. Create the production database

```bash
npx wrangler d1 create graf
```

Copy the printed `database_id` into `wrangler.toml` under `[[d1_databases]]`. Apply the schema:

```bash
npx wrangler d1 migrations apply graf --remote
```

## 5. Secrets

```bash
npx wrangler secret put SECRET        # openssl rand -hex 32
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
```

Optional: adjust [vars] in wrangler.toml (SITE_NAME, SITE_ID, ENABLE_COMMENTS, CACHE_TTL, MAX_PAGE_LENGTH).
If your instance runs behind a custom domain, also set BASE_URL so generated URLs are absolute.

## 6. Deploy (manual — equivalent to step 7 of the auto script)

```bash
npm run deploy     # npx wrangler deploy
```

Your service is now at https://graf.<subdomain>.workers.dev (or whatever the name is).

### 6.1. Deploying from GitHub Actions (optional)

A tag starting with `v` (e.g. `v1.0.0`) triggers `.github/workflows/deploy.yml`, which applies
the D1 migrations and deploys the worker automatically. Add repository secrets:
`CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit + D1:Edit) and `CLOUDFLARE_ACCOUNT_ID`.
`wrangler.toml` must contain the real `database_id` for this to work.

## 7. Custom domain & routes

Add the zone to Cloudflare, then in the dashboard: Workers → graf → Settings → Domains & Routes.
Point your domain at the worker (e.g. `notes.example.com`). Remember BASE_URL=https://notes.example.com.

## 8. Backups

Export everything as JSON from `/admin` (Export JSON) or with curl:

```bash
curl -s -b cookies.txt https://notes.example.com/admin/export > backup.json
```

Restore by POSTing the file to /admin/import while logged in (Content-Type: application/json).
The format is `{ format: "graf-backup", pages: […], comments: […] }`.

You can also snapshot D1 itself from the Cloudflare dashboard (D1 → graf → Export).

## 9. Migrating from the previous Django implementation

1. Export from the previous Django admin (Data Migration → Export Notes) → `django-export.json`.
2. Convert it to the Graf format:

```bash
node scripts/convert-django-backup.mjs django-export.json > graf-backup.json
```

3. Log in to the new instance's /admin and import graf-backup.json.

Notes: the old export contains pages only (no comments/accounts). The old `hashcode` field maps
to `path`. Edit tokens are preserved so old backup-edit links keep working.

## 10. Accessibility inside mainland China (important)

Cloudflare's edge network and `*.workers.dev` are frequently throttled or unreachable from
mainland China, and the China Network product requires ICP/enterprise agreements. If most of your
readers are in mainland China, plan for one of:

- Serve the Worker behind your own domain but put a domestic CDN / reverse proxy in front of
  your zone (the Worker stays the origin), or
- keep using the Django version (`legacy-django` tag/branch in this repo) on a host reachable in
  China; the Telegraph API contract is identical, and data exports are interchangeable.

## 11. Costs & limits

- Workers free plan: 100k requests/day; paid plans remove CPU/time caps concerns.
- D1 free: 5 GB storage, 5M reads/day, 100k writes/day (paid tiers raise these).
- Markdown rendering happens per request (or per CACHE_TTL window) with markdown-it; very large
  pages (close to MAX_PAGE_LENGTH) are the only case where CPU limits could matter — raise
  CACHE_TTL if you see sustained hot reads.


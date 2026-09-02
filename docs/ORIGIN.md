# Graf — origins and relationship to the original project

> TL;DR: vorniches/tapnote (Django, MIT) → **TeleNote** (a feature fork, Django, MIT) → **Graf**
> (this repository: TeleNote rewritten in TypeScript for Cloudflare Workers/D1).

## 1. The original project: vorniches/tapnote

[vorniches/tapnote](https://github.com/vorniches/tapnote) by Sérgio Vorniches (2025) is a
minimalist self-hosted publishing platform inspired by Telegra.ph, written in Django (Python).
It provides a no-account Markdown editor, short URLs and a small Telegraph-style API. It is
MIT-licensed (© 2025 Sergei Vorniches) and its full history is preserved in this repository
under the `legacy-django` tag.

## 2. TeleNote — the fork

TeleNote was created by forking tapnote (by the same author — GitHub account formerly zoidberg-xgd, now redtidev1918). The fork kept
the upstream Django foundation and added:

- a Telegra.ph-compatible API layer (createAccount/createPage/editPage/getPage/getPageList/getViews/…) with Node<->Markdown conversion (`tapnote/telegraph.py`);
- a Markdown-first editor page with Open Graph / social preview cards and short 8-char URLs;
- an optional per-paragraph **comment system** (ParaNote protocol: server endpoints in
  `tapnote/views.py`, client `static/js/paranote.js` vendored from the ParaNote fork), including
  likes, per-comment deletion and user bans;
- admin tools (Django admin, JSON export/import, PythonAnywhere auto-renewal scripts, CI).

TeleNote was publicly announced as a fork of vorniches/tapnote, which is credited in its README.
The two projects diverged completely on code level; only the licence history links them.

## 3. Graf — why a Cloudflare Workers rewrite?

Graf replaces the Django backend with a TypeScript Worker so that the service runs on
Cloudflare's edge with zero servers to operate:

- storage moves to **D1** (SQLite-compatible) with an equivalent schema (accounts/pages/comments/likes/bans);
- the Django admin is replaced by a compact, login-gated `/admin` UI;
- PythonAnywhere/Selenium renewal automation and Docker/Python tooling are gone;
- the same *behavioral contract* is kept so clients keep working: HTTP routes, request/response
  shapes, error codes, the ParaNote comment endpoints, cookie-based edit tokens and the
  Node<->Markdown conventions are ported 1:1 from TeleNote (25 unit tests lock the behaviour).

### What changed on purpose (deltas)

- **Security hardening**: raw HTML in Markdown is no longer passed through (previously the Python
  Markdown renderer emitted it), edit cookies are HttpOnly/SameSite=Lax (+Secure on https),
  anonymous identities are HMAC-derived instead of reversible `md5(ip+site)` hashes, session
  cookies are HMAC-signed, CSP and other security headers are on by default.
- **Bug fixes inherited**: `getPage` now reports the real `views` counter; link/URL handling was
  rewritten with proper URL parsing; import validates every row instead of crashing.
- **Behaviour kept**: 8-char paths, edit-token cookies, view counting on HTML GETs, `createPage`
  returning `can_edit:true`, content accepted as JSON string or array, `return_content` support,
  comment API payloads that `paranote.js` expects, per-minute comment/like rate limits.

## 4. Data & migration

Backups are JSON. The old Django export (list of pages: hashcode/content/title/author/… ) can be
converted with `scripts/convert-django-backup.mjs` and imported through the new /admin — see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) section 8.

## 5. Naming

The project was named *Graf*: telegraph minus “tele”, also “paragraph” in several languages —
a nod to both the Telegraph-compatible API and the paragraph-comment heritage of tapnote/paranote.
It is intentionally a neutral codename; the brand strings are centralised in `src/config.ts`
(SITE_NAME) and `wrangler.toml` (name), so renaming is a two-line change.

## 6. Legal

- Graf's code is a new TypeScript implementation (no Python or Django code is redistributed).
- The vendored `assets/js/paranote.js` client originates from the ParaNote comment project
  (kkty/paranote family, MIT) via the TeleNote-era fork; see THIRD_PARTY_NOTICES.md.
- The repository keeps the full history of tapnote and TeleNote (tag `legacy-django`, branch
  `legacy-django`) so the original MIT-licensed work and its authors remain accessible.
- Licence: MIT. Copyright lines cover Sergei Vorniches (original tapnote) and redtidev1918
  (TeleNote fork and Graf rewrite). See LICENSE and THIRD_PARTY_NOTICES.md.


# Third-party notices

Graf is MIT licensed, but it builds on and redistributes the following works. Their licences
are reproduced here in summary; full texts are available at the cited sources.

## 1. vorniches/tapnote (original project, MIT)

- Author: Sérgio Vorniches (© 2025 Sergei Vorniches).
- Role: original Django publishing platform this project is behaviourally derived from;
  its full commit history is retained in this repo at tag/branch `legacy-django`.
- Licence: MIT (see LICENSE).

## 2. TeleNote fork (MIT)

- Authors: redtidev1918.
- Role: added the Telegraph API surface, ParaNote comment integration, editor/social features;
  behaviour contract ported into Graf's TypeScript.
- Licence: MIT.

## 3. ParaNote client — assets/js/paranote.js (MIT)

- Origin: [kkty/paranote](https://github.com/kkty/paranote) family; the copy shipped here comes
  from the ParaNote fork used by TeleNote (redtidev1918).
- Role: paragraph-level comment UI; consumed verbatim as a static asset.
- Licence: MIT. If you redistribute it, keep the ParaNote attribution.

## 4. markdown-it (MIT)

- https://github.com/markdown-it/markdown-it — CommonMark-compliant Markdown parser (rendering).

## 5. markdown-it-footnote (MIT)

- https://github.com/markdown-it/markdown-it-footnote — footnotes extension.

## 6. Cloudflare Workers tooling (Apache-2.0 / BSD)

- `wrangler`, `workerd`, `miniflare` and friends are development/deployment tooling only; they are
  not part of the shipped service code.

### Licences at a glance

```text
MIT License — vorniches/tapnote, TeleNote, ParaNote client, markdown-it, markdown-it-footnote
Apache-2.0 / BSD-3-Clause — Cloudflare Workers runtime & wrangler tooling
```


// Hand-rolled HTML layout & page fragments. No framework, no build step.
import type { Config } from "./config";
import { esc } from "./util";

export interface LayoutOpts {
  cfg: Config;
  title: string;
  description?: string | null;
  image?: string | null;
  canonical?: string | null;
  bodyClass?: string;
  body: string;
}

function head(opts: LayoutOpts): string {
  const cfg = opts.cfg;
  const desc = esc(opts.description || "");
  const img = opts.image ? esc(opts.image) : "";
  const canonical = opts.canonical ? esc(opts.canonical) : "";
  const parts: string[] = [];
  parts.push("<!DOCTYPE html>");
  parts.push('<html lang="zh-CN">');
  parts.push("<head>");
  parts.push('<meta charset="UTF-8">');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  parts.push("<title>" + esc(opts.title) + "</title>");
  parts.push('<meta name="description" content="' + desc + '">');
  parts.push('<link rel="icon" href="/favicon.ico" type="image/x-icon">');
  parts.push('<link rel="stylesheet" href="/css/site.css">');
  if (canonical) parts.push('<link rel="canonical" href="' + canonical + '">');
  // Open Graph / Twitter
  parts.push('<meta property="og:site_name" content="' + esc(cfg.siteName) + '">');
  parts.push('<meta property="og:title" content="' + esc(opts.title) + '">');
  parts.push('<meta property="og:description" content="' + desc + '">');
  parts.push('<meta property="og:type" content="article">');
  if (img) {
    parts.push('<meta property="og:image" content="' + img + '">');
    parts.push('<meta name="twitter:card" content="summary_large_image">');
    parts.push('<meta name="twitter:image" content="' + img + '">');
  } else {
    parts.push('<meta name="twitter:card" content="summary">');
  }
  parts.push('<meta name="twitter:title" content="' + esc(opts.title) + '">');
  parts.push('<meta name="twitter:description" content="' + desc + '">');
  parts.push("</head>");
  return parts.join("\n");
}

export function layout(opts: LayoutOpts): string {
  const parts = [head(opts)];
  parts.push('<body class="' + esc(opts.bodyClass || "") + '">');
  parts.push(opts.body);
  parts.push("</body>");
  parts.push("</html>");
  return parts.join("\n");
}

export function notFoundPage(cfg: Config): string {
  return layout({
    cfg,
    title: "404 - " + cfg.siteName,
    description: "Page not found",
    bodyClass: "page-404",
    body: '<main class="wrap center"><h1 class="f404">404</h1><p>This page does not exist.</p><p><a class="btn" href="/">Write something</a></p></main>',
  });
}

export function editorPage(cfg: Config, opts: { error?: string | null; action?: string; note?: { title?: string | null; author?: string | null; content?: string | null } | null; isEdit?: boolean }): string {
  const note = opts.note || null;
  const isEdit = opts.isEdit && !!note;
  const title = note && note.title ? note.title : "";
  const author = note && note.author ? note.author : "";
  const content = note ? note.content || "" : "";
  const action = opts.action || (isEdit ? "" : "/publish");
  const err = opts.error ? '<div class="alert">' + esc(opts.error) + "</div>" : "";
  const submitLabel = isEdit ? "Save" : "Publish";
  const parts: string[] = [];
  parts.push('<main class="wrap editor-page">');
  if (isEdit) parts.push('<a class="back" href="/' + esc((note as { path?: string }).path || "") + '/">&larr; back to page</a>');
  parts.push(err);
  parts.push('<form method="post" action="' + esc(action) + '" class="editor">');
  parts.push('<input type="text" name="title" maxlength="200" placeholder="Title" value="' + esc(title) + '">');
  parts.push('<input type="text" name="author" maxlength="100" placeholder="Author (optional)" value="' + esc(author) + '">');
  parts.push('<textarea name="content" placeholder="Write in Markdown…">' + esc(content) + "</textarea>");
  parts.push('<div class="row-end"><button class="btn" type="submit">' + submitLabel + "</button></div>");
  parts.push("</form>");
  parts.push("</main>");
  return layout({
    cfg,
    title: (isEdit ? "Edit - " : "New post - ") + cfg.siteName,
    description: cfg.siteName + " - minimal publishing",
    bodyClass: "editor-body",
    body: parts.join("\n"),
  });
}

export function notePage(cfg: Config, opts: { contentHtml: string; meta: { title: string; description: string; image: string | null; canonical: string; dateLabel: string }; canEdit: boolean; path: string; editToken: string | null }): string {
  const note = opts.meta;
  const headerParts: string[] = [];
  headerParts.push('<header class="post-head">');
  headerParts.push("<h1>" + esc(note.title) + "</h1>");
  headerParts.push('<div class="meta">' + esc(opts.meta.dateLabel) + "</div>");
  headerParts.push("</header>");
  const editBar = opts.canEdit
    ? '<div class="edit-bar"><button class="linklike" data-copy-edit data-url="' + esc(opts.meta.canonical) + '?token=' + esc(opts.editToken || "") + '">Copy edit link</button> <a class="btn btn-sm" href="/' + esc(opts.path) + '/edit">Edit</a></div>'
    : "";
  const comments = cfg.enableComments
    ? '<script defer src="/js/paranote.js" data-site-id="' + esc(cfg.siteId) + '" data-api-base=""></script>'
    : "";
  const body =
    '<article class="wrap note-wrap"><a class="brand" href="/">' + esc(cfg.siteName) + "</a>" +
    editBar +
    headerParts.join("\n") +
    '<div class="markdown-content" data-na-root data-work-id="' + esc(opts.path) + '" data-chapter-id="main">' +
    opts.contentHtml +
    "</div></article>" +
    '<script src="/js/site.js" defer></script>' +
    comments;
  return layout({
    cfg,
    title: note.title,
    description: note.description,
    image: note.image,
    canonical: note.canonical,
    bodyClass: "note-body",
    body,
  });
}

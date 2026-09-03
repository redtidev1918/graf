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
    description: "页面不存在",
    bodyClass: "page-404",
    body: '<main class="wrap center"><h1 class="f404">404</h1><p>页面不存在或已被删除。</p><p><a class="btn" href="/">去写点什么</a></p></main>',
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
  const submitLabel = isEdit ? "保存" : "发布";
  const parts: string[] = [];
  parts.push('<main class="wrap editor-page">');
  if (isEdit) parts.push('<a class="back" href="/' + esc((note as { path?: string }).path || "") + '/">&larr; 返回页面</a>');
  parts.push(err);
  parts.push('<form method="post" action="' + esc(action) + '" class="editor">');
  parts.push('<input type="text" name="title" maxlength="200" placeholder="标题" value="' + esc(title) + '">');
  parts.push('<input type="text" name="author" maxlength="100" placeholder="作者（可选）" value="' + esc(author) + '">');
  parts.push('<textarea name="content" placeholder="用 Markdown 书写…">' + esc(content) + "</textarea>");
  parts.push('<div class="row-end"><button class="btn" type="submit">' + submitLabel + "</button></div>");
  parts.push("</form>");
  parts.push("</main>");
  return layout({
    cfg,
    title: (isEdit ? "编辑 - " : "新建 - ") + cfg.siteName,
    description: cfg.siteName + " · 极简发布",
    bodyClass: "editor-body",
    body: parts.join("\n"),
  });
}

export function notePage(cfg: Config, opts: { contentHtml: string; meta: { title: string; description: string; image: string | null; canonical: string; dateLabel: string }; canEdit: boolean; path: string; editToken: string | null; bookNav?: string }): string {
  const note = opts.meta;
  const headerParts: string[] = [];
  headerParts.push('<header class="post-head">');
  headerParts.push("<h1>" + esc(note.title) + "</h1>");
  headerParts.push('<div class="meta">' + esc(opts.meta.dateLabel) + "</div>");
  headerParts.push("</header>");
  const editBar = opts.canEdit
    ? '<div class="edit-bar"><button class="linklike" data-copy-edit data-url="' + esc(opts.meta.canonical) + '?token=' + esc(opts.editToken || "") + '">复制编辑链接</button> <a class="btn btn-sm" href="/' + esc(opts.path) + '/edit">编辑</a></div>'
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
    "</div>" +
    (opts.bookNav || "") +
    "</article>" +
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
export function chapterNavHtml(opts: { bookPath: string; bookTitle: string; prevPath: string | null; nextPath: string | null; index: number | null; total: number | null }): string {
  const parts: string[] = [];
  parts.push('<nav class="book-nav">');
  if (opts.prevPath) parts.push('<a class="btn btn-sm ghost" href="/' + esc(opts.prevPath) + '/">← 上一章</a> ');
  parts.push('<a class="btn btn-sm ghost" href="/book/' + esc(opts.bookPath) + '">回目录</a>');
  if (opts.nextPath) parts.push(' <a class="btn btn-sm ghost" href="/' + esc(opts.nextPath) + '/">下一章 →</a>');
  if (opts.index != null && opts.total != null) parts.push('<p class="dim small">' + opts.index + ' / ' + opts.total + ' · ' + esc(opts.bookTitle) + '</p>');
  parts.push('</nav>');
  return parts.join('\n');
}

export interface BookListItem {
  path: string;
  title: string;
  author: string;
  description: string;
  count: number;
  lastUpdate: string;
}

export function booksIndexHtml(cfg: Config, items: BookListItem[]): string {
  const rows = items.length
    ? items
        .map((b) => {
          const last = b.lastUpdate ? esc(b.lastUpdate.slice(0, 10)) : '';
          return '<li class="book-item"><a class="book-title" href="/book/' + esc(b.path) + '">' + esc(b.title) + '</a>' +
            (b.author ? '<span class="meta"> 作者：' + esc(b.author) + '</span>' : '') +
            '<p class="meta">' + (b.description ? esc(b.description) : '') + '</p>' +
            '<p class="meta">共 ' + b.count + ' 章 · 最近更新 ' + last + '</p></li>';
        })
        .join('')
    : '<li class="book-item"><p class="meta">还没有作品。</p></li>';
  const body =
    '<main class="wrap"><a class="brand" href="/">' + esc(cfg.siteName) + '</a>' +
    '<h1>作品列表</h1><ul class="book-list">' + rows + '</ul></main>';
  return layout({ cfg, title: '作品列表 - ' + cfg.siteName, description: cfg.siteName + ' 作品列表', bodyClass: 'books-body', body });
}

export interface BookChapterItem {
  path: string;
  title: string;
  order: number | null;
  words: number;
  updated: string;
}

export function bookChaptersHtml(cfg: Config, book: { path: string; title: string; author: string; description: string }, chapters: BookChapterItem[]): string {
  let n = 0;
  const rows = chapters
    .map((ch) => {
      n += 1;
      const label = ch.order != null ? ch.order : n;
      return '<li><a href="/' + esc(ch.path) + '/">' + esc(ch.title || '第 ' + label + ' 章') + '</a>' +
        '<span class="meta"> ' + ch.words + ' 字 · ' + esc(ch.updated.slice(0, 10)) + '</span></li>';
    })
    .join('');
  const body =
    '<main class="wrap"><a class="brand" href="/">' + esc(cfg.siteName) + '</a>' +
    '<h1>' + esc(book.title) + '</h1>' +
    (book.author ? '<p class="meta">作者：' + esc(book.author) + '</p>' : '') +
    (book.description ? '<p>' + esc(book.description) + '</p>' : '') +
    '<ol class="chapter-list">' + rows + '</ol>' +
    '<p><a class="btn btn-sm ghost" href="/books">← 作品列表</a></p></main>';
  return layout({ cfg, title: book.title + ' - ' + cfg.siteName, description: book.description || book.title, bodyClass: 'book-body', body });
}


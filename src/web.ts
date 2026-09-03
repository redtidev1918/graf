// Web pages: home editor, publish, view note, edit note.
import type { Config, Env } from "./config";
import {
  nowIso, plainSnippet, firstImage, formatDateIso, timingSafeEqualStr,
} from "./util";
import { validatePath, randomPath, newEditToken } from "./ids";
import { renderMarkdown } from "./markdown/render";
import { editorPage, notePage, notFoundPage, chapterNavHtml, booksIndexHtml, bookChaptersHtml, type BookListItem, type BookChapterItem } from "./templates";
import * as db from "./db";
import { getCookie } from "./auth";

export interface ReqCtx {
  cfg: Config;
  env: Env;
  request: Request;
  url: URL;
}

const HTML = { "content-type": "text/html; charset=utf-8" };

function html(res: string, status = 200): Response {
  return new Response(res, { status, headers: HTML });
}

function redir(to: string): Response {
  return new Response(null, { status: 303, headers: { location: to } });
}

function editCookieName(path: string): string {
  return "edit_token_" + path;
}

function cookieSecure(cfg: Config, url: URL): boolean {
  if (cfg.baseUrl && cfg.baseUrl.startsWith("https://")) return true;
  return url.protocol === "https:";
}

function setEditCookie(cfg: Config, url: URL, path: string, token: string): string {
  const secure = cookieSecure(cfg, url);
  const parts = [
    editCookieName(path) + "=" + encodeURIComponent(token),
    "Path=/",
    "Max-Age=" + 31536000,
    "HttpOnly",
  ];
  if (secure) parts.push("Secure");
  parts.push("SameSite=Lax");
  return parts.join("; ");
}

export async function homePage(c: ReqCtx): Promise<Response> {
  return html(editorPage(c.cfg, {}));
}

export async function publishPage(c: ReqCtx): Promise<Response> {
  if (c.request.method === "GET") {
    return redir("/");
  }
  const form = await c.request.formData().catch(() => null);
  if (!form) return html(editorPage(c.cfg, { error: "Invalid form data" }), 400);
  const content = (form.get("content") || "").toString().trim();
  const title = (form.get("title") || "").toString().trim();
  const author = (form.get("author") || "").toString().trim();
  const linkTarget = form.get("link_target") === "_blank" ? "_blank" : "_self";
  if (content.length === 0) return redir("/");
  if (content.length > c.cfg.maxPageLength) {
    return html(editorPage(c.cfg, { error: "内容超过 " + c.cfg.maxPageLength + " 字符上限。" }), 400);
  }
  const page = await db.createPage(c.env.DB, {
    path: randomPath(),
    title: title.slice(0, 200),
    author: author.slice(0, 100),
    content,
    link_target: linkTarget,
    edit_token: newEditToken(),
    account_id: null,
    created_at: nowIso(),
  });
  const res = redir("/" + page.path + "/");
  res.headers.append("Set-Cookie", setEditCookie(c.cfg, c.url, page.path, page.edit_token));
  return res;
}

async function editCookieOrToken(c: ReqCtx, page: db.PageRow): Promise<boolean> {
  const cookie = getCookie(c.request, editCookieName(page.path));
  if (cookie && (await timingSafeEqualStr(cookie, page.edit_token))) return true;
  const qToken = c.url.searchParams.get("token");
  if (qToken && (await timingSafeEqualStr(qToken, page.edit_token))) return true;
  return false;
}

export async function viewPage(c: ReqCtx, path: string): Promise<Response> {
  if (!validatePath(path)) return html(notFoundPage(c.cfg), 404);
  const page = await db.pageByPath(c.env.DB, path);
  if (!page) return html(notFoundPage(c.cfg), 404);

  const origin = c.cfg.baseUrl || c.url.origin;
  const canonical = origin + "/" + page.path + "/";
  const isHead = c.request.headers.get("x-graf-head") === "1";

  const cookieToken = getCookie(c.request, editCookieName(page.path));
  const cookieOk = !!cookieToken && (await timingSafeEqualStr(cookieToken, page.edit_token).catch(() => false));
  const qToken = c.url.searchParams.get("token");
  const qOk = !!qToken && (await timingSafeEqualStr(qToken, page.edit_token).catch(() => false));
  const canEdit = cookieOk || qOk;

  // A valid ?token= grants the cookie, then we move the user to the clean URL so the
  // secret never lingers in the address bar / history / Referer.
  if (!isHead && c.request.method === "GET" && qOk && !cookieOk) {
    const rr = redir(canonical);
    rr.headers.append("Set-Cookie", setEditCookie(c.cfg, c.url, page.path, page.edit_token));
    return rr;
  }

  // Count views for real HTML page GETs only (not HEAD probes).
  if (c.request.method === "GET" && !isHead) {
    await db.incrementViews(c.env.DB, page.id).catch(() => {});
  }

  const contentHtml = renderMarkdown(page.content, { linkTarget: page.link_target === "_blank" ? "_blank" : "_self" });

  // meta
  const lines = page.content.split("\n");
  let metaTitle = page.title || cfgSite(c.cfg) + " · 页面";
  if (!page.title && lines.length) {
    const cand = lines[0]!.replace(/^#+\s*/, "").trim();
    if (cand) metaTitle = cand.slice(0, 120);
  }
  const metaDescription = page.author ? "作者 " + page.author + " · " + plainSnippet(page.content, 180) : plainSnippet(page.content, 180);
  const image = firstImage(page.content);

  let bookNav: string | undefined;
  if (c.cfg.enableBooks && page.book_id != null) {
    try {
      const book = await db.bookById(c.env.DB, page.book_id);
      if (book) {
        const chapters = await db.pagesByBook(c.env.DB, book.id);
        const idx = chapters.findIndex((p) => p.id === page.id);
        if (idx >= 0) {
          const prev = idx > 0 ? chapters[idx - 1] : undefined;
          const next = idx < chapters.length - 1 ? chapters[idx + 1] : undefined;
          bookNav = chapterNavHtml({
            bookPath: book.path,
            bookTitle: book.title,
            prevPath: prev ? prev.path : null,
            nextPath: next ? next.path : null,
            index: idx + 1,
            total: chapters.length,
          });
        }
      }
    } catch {
      bookNav = undefined;
    }
  }

  let res = html(
    notePage(c.cfg, {
      contentHtml,
      meta: {
        title: metaTitle,
        description: metaDescription,
        image,
        canonical,
        dateLabel: formatDateIso(page.updated_at || page.created_at),
      },
      canEdit,
      path: page.path,
      editToken: canEdit ? page.edit_token : null,
      bookNav,
    }),
  );

  // optional edge caching for anonymous views
  if (c.cfg.cacheTtlSeconds > 0 && !canEdit) {
    const cacheKey = new Request(canonical + "?v=" + encodeURIComponent(page.updated_at), { method: "GET" });
    try {
      const hit = await caches.default.match(cacheKey);
      if (hit) return hit;
      const withCache = new Response(res.clone().body, { status: res.status, headers: res.headers });
      withCache.headers.set("Cache-Control", "public, max-age=" + c.cfg.cacheTtlSeconds);
      const cached = new Response(withCache.clone().body, { status: withCache.status, headers: withCache.headers });
      await caches.default.put(cacheKey, cached);
      return withCache;
    } catch {
      return res;
    }
  }
  return res;
}

function cfgSite(cfg: Config): string {
  return cfg.siteName;
}

export async function editPageWeb(c: ReqCtx, path: string): Promise<Response> {
  if (!validatePath(path)) return html(notFoundPage(c.cfg), 404);
  const page = await db.pageByPath(c.env.DB, path);
  if (!page) return html(notFoundPage(c.cfg), 404);
  const cookieToken = getCookie(c.request, editCookieName(page.path));
  const cookieOk = !!cookieToken && (await timingSafeEqualStr(cookieToken, page.edit_token).catch(() => false));
  const qToken = c.url.searchParams.get("token");
  const qOk = !!qToken && (await timingSafeEqualStr(qToken, page.edit_token).catch(() => false));
  const canEdit = cookieOk || qOk;
  if (!canEdit) return html(notFoundPage(c.cfg), 404);
  // Persist the right on the GET so the form POST (no token) works afterwards,
  // and the secret token leaves the address bar.
  const persistToken = c.request.method === "GET" && qOk && !cookieOk;

  if (c.request.method === "POST") {
    const form = await c.request.formData().catch(() => null);
    if (!form) return html(editorPage(c.cfg, { isEdit: true, action: "/" + page.path + "/edit", note: { title: page.title, author: page.author, content: page.content } }), 400);
    const content = (form.get("content") || "").toString().trim();
    const title = (form.get("title") || "").toString().trim();
    const author = (form.get("author") || "").toString().trim();
    if (content.length > 0 && content.length <= c.cfg.maxPageLength) {
      await db.updatePageContent(c.env.DB, page.id, {
        title: title.slice(0, 200),
        author: author.slice(0, 100),
        content,
        link_target: page.link_target,
        updated_at: nowIso(),
      });
      const res = redir("/" + page.path + "/");
      res.headers.append("Set-Cookie", setEditCookie(c.cfg, c.url, page.path, page.edit_token));
      return res;
    }
    if (content.length > c.cfg.maxPageLength) {
      return html(editorPage(c.cfg, { isEdit: true, error: "内容超过 " + c.cfg.maxPageLength + " 字符上限。", action: "/" + page.path + "/edit", note: { title: page.title, author: page.author, content } }), 400);
    }
  }
  const editRes = html(
    editorPage(c.cfg, {
      isEdit: true,
      action: "/" + page.path + "/edit",
      note: { title: page.title, author: page.author, content: page.content },
    }),
  );
  if (persistToken) editRes.headers.append("Set-Cookie", setEditCookie(c.cfg, c.url, page.path, page.edit_token));
  return editRes;
}

export function notFoundHtml(cfg: Config): Response {
  return html(notFoundPage(cfg), 404);
}
export async function booksIndex(c: ReqCtx): Promise<Response> {
  const books = await db.listBooks(c.env.DB);
  const stats = await db.bookStats(c.env.DB);
  const statMap = new Map<number, { n: number; last_update: string }>();
  for (const st of stats) statMap.set(st.book_id, st);
  const items: BookListItem[] = books.map((b) => {
    const st = statMap.get(b.id);
    return {
      path: b.path,
      title: b.title,
      author: b.author,
      description: b.description,
      count: st ? st.n : 0,
      lastUpdate: st ? st.last_update : b.updated_at,
    };
  });
  return html(booksIndexHtml(c.cfg, items));
}

export async function bookDetail(c: ReqCtx, bookPath: string): Promise<Response> {
  if (!db.BOOK_PATH_RE.test(bookPath)) return html(notFoundPage(c.cfg), 404);
  const book = await db.bookByPath(c.env.DB, bookPath);
  if (!book) return html(notFoundPage(c.cfg), 404);
  const chapters = await db.pagesByBook(c.env.DB, book.id);
  const items: BookChapterItem[] = chapters.map((p) => ({
    path: p.path,
    title: p.title,
    order: p.order_num,
    words: p.content.length,
    updated: p.updated_at,
  }));
  return html(
    bookChaptersHtml(c.cfg, { path: book.path, title: book.title, author: book.author, description: book.description }, items),
  );
}


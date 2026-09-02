// Web pages: home editor, publish, view note, edit note.
import type { Config, Env } from "./config";
import {
  nowIso, plainSnippet, firstImage, formatDateIso, timingSafeEqualStr,
} from "./util";
import { validatePath, randomPath, newEditToken } from "./ids";
import { renderMarkdown } from "./markdown/render";
import { editorPage, notePage, notFoundPage } from "./templates";
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
    return html(editorPage(c.cfg, { error: "Content exceeds the limit of " + c.cfg.maxPageLength + " characters." }), 400);
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

  const canEdit = await editCookieOrToken(c, page);
  const qToken = c.url.searchParams.get("token");

  // bump view counter (cheap; keep parity with the Django version)
  await db.incrementViews(c.env.DB, page.id).catch(() => {});

  const contentHtml = renderMarkdown(page.content, { linkTarget: page.link_target === "_blank" ? "_blank" : "_self" });

  // meta
  const lines = page.content.split("\n");
  let metaTitle = page.title || cfgSite(c.cfg) + " page";
  if (!page.title && lines.length) {
    const cand = lines[0]!.replace(/^#+\s*/, "").trim();
    if (cand) metaTitle = cand.slice(0, 120);
  }
  const metaDescription = page.author ? "By " + page.author + ". " + plainSnippet(page.content, 180) : plainSnippet(page.content, 180);
  const image = firstImage(page.content);
  const origin = c.cfg.baseUrl || c.url.origin;
  const canonical = origin + "/" + page.path + "/";

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
    }),
  );

  // persist edit permission when arriving with a valid ?token=
  if (!canEdit && qToken) {
    const ok = await timingSafeEqualStr(qToken, page.edit_token).catch(() => false);
    if (ok) {
      res.headers.append("Set-Cookie", setEditCookie(c.cfg, c.url, page.path, page.edit_token));
    }
  }

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
  const canEdit = await editCookieOrToken(c, page);
  if (!canEdit) return html(notFoundPage(c.cfg), 404);

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
      return html(editorPage(c.cfg, { isEdit: true, error: "Content exceeds the limit of " + c.cfg.maxPageLength + " characters.", action: "/" + page.path + "/edit", note: { title: page.title, author: page.author, content } }), 400);
    }
  }
  return html(
    editorPage(c.cfg, {
      isEdit: true,
      action: "/" + page.path + "/edit",
      note: { title: page.title, author: page.author, content: page.content },
    }),
  );
}

export function notFoundHtml(cfg: Config): Response {
  return html(notFoundPage(cfg), 404);
}

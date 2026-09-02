// Minimal admin UI (session-cookie guarded): dashboard, moderation, export/import.
import type { Config, Env } from "./config";
import { esc, json, nowIso, toInt, str } from "./util";
import {
  adminEnabled, checkAdminLogin, verifySession, ADMIN_COOKIE, getCookie,
  setCookieValue, clearCookie, commentUserId, signSession,
} from "./auth";
import { layout } from "./templates";
import { validatePath, validateId } from "./ids";
import * as db from "./db";
import { countAccounts as dbCountAccounts } from "./db";

const HTML = { "content-type": "text/html; charset=utf-8" };
const html = (s: string, status = 200) => new Response(s, { status, headers: HTML });

export interface ReqCtx {
  cfg: Config;
  env: Env;
  request: Request;
  url: URL;
}

function redir(to: string): Response {
  return new Response(null, { status: 303, headers: { location: to } });
}

function adminShell(cfg: Config, title: string, body: string, active = ""): string {
  const nav: string[] = [];
  const links: Array<[string, string, string]> = [
    ["/admin", "Dashboard", "dash"],
    ["/admin/pages", "Pages", "pages"],
    ["/admin/comments", "Comments", "comments"],
  ];
  for (const [href, label, key] of links) {
    nav.push('<a href="' + href + '" class="' + (key === active ? "on" : "") + '">' + label + "</a>");
  }
  return layout({
    cfg,
    title: title + " - " + cfg.siteName + " admin",
    description: "Admin",
    bodyClass: "admin",
    body:
      '<nav class="admin-nav wrap">' + nav.join(" ") +
      '<form method="post" action="/admin/logout" class="inline"><button class="btn btn-sm ghost" type="submit">Log out</button></form>' +
      "</nav>" +
      '<main class="wrap admin-main">' + body + "</main>" +
      '<script src="/js/admin.js" defer></script>',
  });
}

function loginPage(cfg: Config, message: string | null): string {
  const note = adminEnabled(cfg)
    ? ""
    : '<p class="alert">Admin is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD (environment/secret) first.</p>';
  const err = message ? '<p class="alert">' + esc(message) + "</p>" : "";
  return layout({
    cfg,
    title: "Admin login - " + cfg.siteName,
    description: "Admin login",
    bodyClass: "admin",
    body:
      '<main class="wrap center narrow">' +
      '<h1 class="brand">' + esc(cfg.siteName) + " admin</h1>" +
      note + err +
      '<form method="post" action="/admin/login" class="stack">' +
      '<input type="text" name="username" placeholder="Username" autocomplete="username">' +
      '<input type="password" name="password" placeholder="Password" autocomplete="current-password">' +
      '<button class="btn" type="submit">Sign in</button>' +
      "</form></main>",
  });
}

export async function routeAdmin(c: ReqCtx): Promise<Response> {
  const { request, url } = c;
  const path = url.pathname;

  // login page
  if (path === "/admin/login") {
    if (request.method === "POST") {
      if (!adminEnabled(c.cfg)) return html(loginPage(c.cfg, "Admin is not configured."), 403);
      const form = await request.formData().catch(() => null);
      const username = form ? (form.get("username") || "").toString() : "";
      const password = form ? (form.get("password") || "").toString() : "";
      if (await checkAdminLogin(c.cfg, username, password)) {
        const token = await signSession(c.cfg, username);
        const next = c.url.searchParams.get("next") || "/admin";
        const res = redir(next);
        res.headers.append("Set-Cookie", setCookieValue(ADMIN_COOKIE, token, { path: "/", maxAge: 7 * 86400, httpOnly: true, secure: cookieSecure(c.cfg, url) }));
        return res;
      }
      return html(loginPage(c.cfg, "Invalid credentials."), 403);
    }
    const session = await verifySession(c.cfg, getCookie(request, ADMIN_COOKIE));
    if (session) return redir("/admin");
    return html(loginPage(c.cfg, null));
  }

  // everything else requires a session
  const session = await verifySession(c.cfg, getCookie(request, ADMIN_COOKIE));
  if (!session) {
    const res = redir("/admin/login?next=" + encodeURIComponent(path));
    return res;
  }

  if (path === "/admin/logout" && request.method === "POST") {
    const res = redir("/admin/login");
    res.headers.append("Set-Cookie", clearCookie(ADMIN_COOKIE, "/"));
    return res;
  }

  if (path === "/admin" || path === "/admin/") return dashboard(c);
  if (path === "/admin/pages") return pagesList(c);
  if (path === "/admin/actions/delete-page") return deletePageAction(c);
  if (path === "/admin/comments") return commentsMod(c);
  if (path === "/admin/actions/delete-comment") return deleteCommentAction(c);
  if (path === "/admin/export") return exportData(c);
  if (path === "/admin/import") return importData(c);
  return html(adminShell(c.cfg, "Not found", "<p>Not found.</p>"), 404);
}



function cookieSecure(cfg: Config, url: URL): boolean {
  return (cfg.baseUrl && cfg.baseUrl.startsWith("https://")) || url.protocol === "https:";
}

function fmtTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function escSnippet(s: string | null, n = 80): string {
  if (!s) return "";
  const clean = s.replace(/\s+/g, " ").trim();
  return esc(clean.length > n ? clean.slice(0, n) + "…" : clean);
}

async function dashboard(c: ReqCtx): Promise<Response> {
  const [pages, comments, accounts, recent] = await Promise.all([
    db.countPages(c.env.DB),
    db.countComments(c.env.DB),
    dbCountAccounts(c.env.DB),
    db.recentPages(c.env.DB, 15),
  ]);
  const rows = recent
    .map((p) => {
      const delForm = '<form class="inline" method="post" action="/admin/actions/delete-page" data-confirm="Delete this page?"><input type="hidden" name="path" value="' + esc(p.path) + '"><button class="btn btn-sm danger" type="submit">Delete</button></form>';
      return (
        '<tr><td><a href="/' + esc(p.path) + '/">' + esc(p.path) + '</a></td>' +
        '<td>' + esc(p.title || "(untitled)") + '</td>' +
        '<td>' + esc(p.author || "") + '</td>' +
        '<td>' + p.views + '</td>' +
        '<td>' + fmtTime(p.created_at) + '</td>' +
        '<td>' + delForm + '</td></tr>'
      );
    })
    .join("");
  const body =
    '<div class="stat-row">' +
    '<div class="stat"><b>' + pages + "</b><span>pages</span></div>" +
    '<div class="stat"><b>' + comments + "</b><span>comments</span></div>" +
    '<div class="stat"><b>' + accounts + "</b><span>accounts</span></div>" +
    "</div>" +
    '<p class="row-end"><a class="btn btn-sm" href="/admin/export">Export JSON</a> ' +
    '<a class="btn btn-sm ghost" href="/admin/import">Import JSON</a></p>' +
    "<h2>Recent pages</h2>" +
    '<table class="table"><thead><tr><th>Path</th><th>Title</th><th>Author</th><th>Views</th><th>Created</th><th></th></tr></thead><tbody>' +
    rows +
    "</tbody></table>" +
    '<p><a class="btn btn-sm ghost" href="/admin/pages">Browse / search all pages</a></p>';
  return html(adminShell(c.cfg, "Dashboard", body, "dash"));
}

async function pagesList(c: ReqCtx): Promise<Response> {
  const q = c.url.searchParams.get("q") || "";
  const pages = q ? await db.searchPages(c.env.DB, q, 200) : await db.recentPages(c.env.DB, 200);
  const rows = pages
    .map((p) => {
      const delForm = '<form class="inline" method="post" action="/admin/actions/delete-page" data-confirm="Delete this page?"><input type="hidden" name="path" value="' + esc(p.path) + '"><button class="btn btn-sm danger" type="submit">Delete</button></form>';
      return (
        '<tr><td><a href="/' + esc(p.path) + '/">' + esc(p.path) + '</a></td>' +
        '<td>' + esc(p.title || "(untitled)") + '</td>' +
        '<td>' + esc(p.author || "") + '</td>' +
        '<td>' + p.views + '</td>' +
        '<td>' + fmtTime(p.created_at) + '</td>' +
        '<td><a class="btn btn-sm ghost" href="/' + esc(p.path) + '/edit">Edit</a> ' + delForm + '</td></tr>'
      );
    })
    .join("");
  const body =
    '<h1>Pages</h1>' +
    '<form method="get" class="row"><input type="search" name="q" value="' + esc(q) + '" placeholder="search path / title / author"><button class="btn btn-sm" type="submit">Search</button></form>' +
    '<table class="table"><thead><tr><th>Path</th><th>Title</th><th>Author</th><th>Views</th><th>Created</th><th></th></tr></thead><tbody>' +
    rows +
    "</tbody></table>";
  return html(adminShell(c.cfg, "Pages", body, "pages"));
}

async function deletePageAction(c: ReqCtx): Promise<Response> {
  if (c.request.method !== "POST") return redir("/admin/pages");
  const form = await c.request.formData().catch(() => null);
  const path = form ? (form.get("path") || "").toString() : "";
  if (validatePath(path)) {
    const page = await db.pageByPath(c.env.DB, path);
    if (page) await db.deletePage(c.env.DB, page.id);
  }
  const back = c.request.headers.get("referer");
  return redir(back && back.includes("/admin") ? back : "/admin");
}

async function commentsMod(c: ReqCtx): Promise<Response> {
  const siteId = c.url.searchParams.get("siteId") || "";
  const workId = c.url.searchParams.get("workId") || "";
  const list = siteId && workId ? await db.commentsByWork(c.env.DB, siteId, workId, "main") : await db.recentComments(c.env.DB, null, 100);
  const rows = list
    .map((cm) => {
      const delForm = '<form class="inline" method="post" action="/admin/actions/delete-comment" data-confirm="Delete this comment?"><input type="hidden" name="id" value="' + cm.id + '"><button class="btn btn-sm danger" type="submit">Delete</button></form>';
      return (
        '<tr><td>' + esc(cm.user_name) + '<br><small>' + esc(cm.user_id || cm.ip || "") + '</small></td>' +
        '<td>' + escSnippet(cm.content) + '</td>' +
        '<td>' + esc(cm.site_id) + ' / ' + esc(cm.work_id) + ' #' + cm.para_index + '</td>' +
        '<td>' + cm.likes + '</td>' +
        '<td>' + fmtTime(cm.created_at) + '</td>' +
        '<td>' + delForm + '</td></tr>'
      );
    })
    .join("");
  const body =
    '<h1>Comments</h1>' +
    '<form method="get" class="row"><input type="text" name="siteId" value="' + esc(siteId) + '" placeholder="siteId"><input type="text" name="workId" value="' + esc(workId) + '" placeholder="workId (page path)"><button class="btn btn-sm" type="submit">Filter</button></form>' +
    '<table class="table"><thead><tr><th>User</th><th>Comment</th><th>Location</th><th>Likes</th><th>Time</th><th></th></tr></thead><tbody>' +
    rows +
    "</tbody></table>";
  return html(adminShell(c.cfg, "Comments", body, "comments"));
}

async function deleteCommentAction(c: ReqCtx): Promise<Response> {
  if (c.request.method !== "POST") return redir("/admin/comments");
  const form = await c.request.formData().catch(() => null);
  const id = form ? toInt(form.get("id")) : undefined;
  if (id !== undefined) await db.deleteComment(c.env.DB, id);
  const back = c.request.headers.get("referer");
  return redir(back && back.includes("/admin") ? back : "/admin/comments");
}

async function exportData(c: ReqCtx): Promise<Response> {
  const [pages, comments] = await Promise.all([db.allPagesForExport(c.env.DB), db.allCommentsForExport(c.env.DB)]);
  const payload = {
    format: "graf-backup",
    version: 1,
    exportedAt: nowIso(),
    siteId: c.cfg.siteId,
    pages: pages.map((p) => ({
      path: p.path, title: p.title, author: p.author, content: p.content,
      link_target: p.link_target, edit_token: p.edit_token, views: p.views,
      created_at: p.created_at, updated_at: p.updated_at,
    })),
    comments: comments.map((cm) => ({
      site_id: cm.site_id, work_id: cm.work_id, chapter_id: cm.chapter_id, para_index: cm.para_index,
      content: cm.content, user_name: cm.user_name, user_id: cm.user_id, user_avatar: cm.user_avatar,
      context_text: cm.context_text, likes: cm.likes, created_at: cm.created_at,
    })),
  };
  const stamp = nowIso().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="graf-backup-' + stamp + '.json"',
    },
  });
}

async function importData(c: ReqCtx): Promise<Response> {
  if (c.request.method === "GET") {
    const body =
      '<h1>Import JSON backup</h1>' +
      '<p>POST this page with the backup as the raw JSON body, or run:</p>' +
      '<pre>curl -X POST -H "Content-Type: application/json" --cookie "graf_admin=..." --data-binary @backup.json ' +
      esc(c.cfg.baseUrl || (c.url.origin + "/admin/import")) + "</pre>" +
      '<p><a class="btn btn-sm ghost" href="/admin">Back</a></p>';
    return html(adminShell(c.cfg, "Import", body));
  }
  try {
    const data = (await c.request.json()) as {
      pages?: unknown[];
      comments?: unknown[];
    };
    let pageCount = 0;
    let commentCount = 0;
    let skipped = 0;

    if (Array.isArray(data.pages)) {
      for (const raw of data.pages) {
        const p = raw as Record<string, unknown>;
        const path = str(p.path);
        const content = str(p.content);
        if (!validatePath(path) || content === undefined || content.length > c.cfg.maxPageLength) {
          skipped++;
          continue;
        }
        const title = (str(p.title) || "").slice(0, 200);
        const author = (str(p.author) || "").slice(0, 100);
        const editToken = str(p.edit_token) || "";
        const created = str(p.created_at) || nowIso();
        const updated = str(p.updated_at) || created;
        const linkTarget = p.link_target === "_blank" ? "_blank" : "_self";
        const views = typeof p.views === "number" ? Math.max(0, Math.floor(p.views)) : 0;
        await upsertPage(c, { path, title, author, content, link_target: linkTarget, edit_token: editToken, views, created_at: created, updated_at: updated });
        pageCount++;
      }
    }
    if (Array.isArray(data.comments)) {
      for (const raw of data.comments) {
        const cm = raw as Record<string, unknown>;
        const siteId = str(cm.site_id);
        const workId = str(cm.work_id);
        const chapterId = str(cm.chapter_id);
        const content = str(cm.content);
        const paraIndex = toInt(cm.para_index);
        if (!siteId || !workId || !chapterId || !validateId(siteId) || !validateId(workId) || !validateId(chapterId) || !content || paraIndex === undefined) {
          skipped++;
          continue;
        }
        const ip = str(cm.ip) || null;
        let userId = str(cm.user_id) || null;
        let userName = str(cm.user_name) || c.cfg.anonymousName;
        if (!userId && ip && c.cfg.secret) {
          const uid = await commentUserId(ip, siteId, c.cfg.secret);
          userId = uid;
          userName = c.cfg.commentGuestPrefix + uid.slice(3, 9);
        }
        await db.createComment(c.env.DB, {
          site_id: siteId, work_id: workId, chapter_id: chapterId, para_index: paraIndex,
          content, user_name: userName, user_id: userId,
          user_avatar: str(cm.user_avatar) || null, context_text: str(cm.context_text) || null,
          ip, created_at: str(cm.created_at) || nowIso(),
        });
        commentCount++;
      }
    }
    const body =
      "<h1>Import finished</h1>" +
      "<p>Imported pages: <b>" + pageCount + "</b>, comments: <b>" + commentCount + "</b>, skipped: <b>" + skipped + "</b>.</p>" +
      '<p><a class="btn btn-sm" href="/admin">Dashboard</a></p>';
    return html(adminShell(c.cfg, "Import", body));
  } catch (e) {
    return html(adminShell(c.cfg, "Import error", '<p class="alert">Failed to parse JSON backup: ' + esc(e instanceof Error ? e.message : String(e)) + '</p>'), 400);
  }
}

async function upsertPage(c: ReqCtx, p: { path: string; title: string; author: string; content: string; link_target: string; edit_token: string; views: number; created_at: string; updated_at: string }): Promise<void> {
  const existing = await db.pageByPath(c.env.DB, p.path);
  if (existing) {
    await db.updatePageContent(c.env.DB, existing.id, { title: p.title, author: p.author, content: p.content, link_target: p.link_target, updated_at: p.updated_at });
  } else {
    await db.createPage(c.env.DB, {
      path: p.path, title: p.title, author: p.author, content: p.content,
      link_target: p.link_target, edit_token: p.edit_token || "imported",
      account_id: null, created_at: p.created_at,
    });
  }
}

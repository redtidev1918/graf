// Minimal admin UI (session-cookie guarded): dashboard, moderation, export/import.
import type { Config, Env } from "./config";
import { esc, nowIso, toInt, str, clientIp, sameOriginOk } from "./util";
import {
  adminEnabled, checkAdminLogin, verifySession, ADMIN_COOKIE, getCookie,
  setCookieValue, clearCookie, signSession,
} from "./auth";
import { layout } from "./templates";
import { validatePath, validateId } from "./ids";
import * as db from "./db";
import { countAccounts as dbCountAccounts } from "./db";
import type { BackupPage, BackupComment } from "./db";

const PAGE_SIZE = 50;
const ADMIN_PATH_RE = /^\/admin(\/|$)/;

/** Only local /admin paths are allowed as the post-login destination. */
function safeLocalPath(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") && ADMIN_PATH_RE.test(next)) {
    return next;
  }
  return "/admin";
}

// Lightweight in-isolate brute-force throttle (see docs: pair with Cloudflare
// rate limiting / Turnstile for global protection; never store plaintext here).
const LOGIN_ATTEMPTS = new Map<string, { count: number; until: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

export function __resetLoginAttempts(): void {
  LOGIN_ATTEMPTS.clear();
}

function loginThrottled(c: ReqCtx): boolean {
  const rec = LOGIN_ATTEMPTS.get(clientIp(c.request) || "unknown");
  return !!rec && rec.until > Date.now();
}
function recordLoginFailure(c: ReqCtx): void {
  const key = clientIp(c.request) || "unknown";
  const rec = LOGIN_ATTEMPTS.get(key) || { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= MAX_LOGIN_ATTEMPTS) rec.until = Date.now() + LOCK_MS;
  LOGIN_ATTEMPTS.set(key, rec);
}
function clearLoginFailures(c: ReqCtx): void {
  LOGIN_ATTEMPTS.delete(clientIp(c.request) || "unknown");
}

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
  const unsafeMethod = request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS";

  // CSRF/origin guard for every cookie-authenticated mutation under /admin.
  if (unsafeMethod && !sameOriginOk(request, url)) {
    return html(adminShell(c.cfg, "Forbidden", '<p class="alert">来源校验失败（跨站请求被拒绝）。</p>'), 403);
  }

  // login page
  if (path === "/admin/login") {
    if (request.method === "POST") {
      if (!adminEnabled(c.cfg)) return html(loginPage(c.cfg, "Admin is not configured."), 403);
      if (loginThrottled(c)) return html(loginPage(c.cfg, "尝试次数过多，请 10 分钟后再试。"), 429);
      const form = await request.formData().catch(() => null);
      const username = form ? (form.get("username") || "").toString() : "";
      const password = form ? (form.get("password") || "").toString() : "";
      if (username && password && (await checkAdminLogin(c.cfg, username, password))) {
        clearLoginFailures(c);
        const token = await signSession(c.cfg, username);
        const next = safeLocalPath(c.url.searchParams.get("next"));
        const res = redir(next);
        res.headers.append("Set-Cookie", setCookieValue(ADMIN_COOKIE, token, { path: "/", maxAge: 7 * 86400, httpOnly: true, secure: cookieSecure(c.cfg, url) }));
        return res;
      }
      recordLoginFailure(c);
      return html(loginPage(c.cfg, "用户名或密码错误。"), 403);
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
    '<p class="alert" style="background:#fffbeb;color:#92400e;border-color:#fde68a">备份包含编辑令牌(edit_token)，请安全保存；不含账号 access_token 与访客原始 IP。</p>' +
    "<h2>Recent pages</h2>" +
    '<table class="table"><thead><tr><th>Path</th><th>Title</th><th>Author</th><th>Views</th><th>Created</th><th></th></tr></thead><tbody>' +
    rows +
    "</tbody></table>" +
    '<p><a class="btn btn-sm ghost" href="/admin/pages">Browse / search all pages</a></p>';
  return html(adminShell(c.cfg, "Dashboard", body, "dash"));
}

async function pagesList(c: ReqCtx): Promise<Response> {
  const q = c.url.searchParams.get("q") || "";
  const page = Math.max(0, toInt(c.url.searchParams.get("p")) || 0);
  const offset = page * PAGE_SIZE;
  const fetched = q ? await db.searchPages(c.env.DB, q, PAGE_SIZE + 1, offset) : await db.recentPages(c.env.DB, PAGE_SIZE + 1, offset);
  const pages = fetched.slice(0, PAGE_SIZE);
  const hasMore = fetched.length > PAGE_SIZE;
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
  const pager =
    '<p class="row">' +
    (page > 0 ? '<a class="btn btn-sm ghost" href="/admin/pages?q=' + encodeURIComponent(q) + '&p=' + (page - 1) + '">← Prev</a> ' : "") +
    (hasMore ? '<a class="btn btn-sm ghost" href="/admin/pages?q=' + encodeURIComponent(q) + '&p=' + (page + 1) + '">Next →</a>' : "") +
    " <span class=\"dim\">第 " + (page + 1) + " 页（每页 " + PAGE_SIZE + " 条）</span></p>";
  const body =
    '<h1>Pages</h1>' +
    '<form method="get" class="row"><input type="search" name="q" value="' + esc(q) + '" placeholder="search path / title / author"><input type="hidden" name="p" value="' + page + '"><button class="btn btn-sm" type="submit">Search</button></form>' +
    '<table class="table"><thead><tr><th>Path</th><th>Title</th><th>Author</th><th>Views</th><th>Created</th><th></th></tr></thead><tbody>' +
    rows +
    "</tbody></table>" +
    pager;
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
  const page = Math.max(0, toInt(c.url.searchParams.get("p")) || 0);
  const offset = page * PAGE_SIZE;
  let list: db.CommentRow[];
  let hasMore = false;
  if (siteId && workId) {
    list = (await db.commentsByWork(c.env.DB, siteId, workId, "main")).slice(offset, offset + PAGE_SIZE);
  } else {
    const fetched = await db.recentComments(c.env.DB, null, PAGE_SIZE + 1, offset);
    hasMore = fetched.length > PAGE_SIZE;
    list = fetched.slice(0, PAGE_SIZE);
  }
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
  const pager =
    '<p class="row">' +
    (page > 0 ? '<a class="btn btn-sm ghost" href="/admin/comments?siteId=' + encodeURIComponent(siteId) + '&workId=' + encodeURIComponent(workId) + '&p=' + (page - 1) + '">← Prev</a> ' : "") +
    (hasMore ? '<a class="btn btn-sm ghost" href="/admin/comments?siteId=' + encodeURIComponent(siteId) + '&workId=' + encodeURIComponent(workId) + '&p=' + (page + 1) + '">Next →</a>' : "") +
    " <span class=\"dim\">第 " + (page + 1) + " 页（每页 " + PAGE_SIZE + " 条）</span></p>";
  const body =
    '<h1>Comments</h1>' +
    '<form method="get" class="row"><input type="text" name="siteId" value="' + esc(siteId) + '" placeholder="siteId"><input type="text" name="workId" value="' + esc(workId) + '" placeholder="workId (page path)"><button class="btn btn-sm" type="submit">Filter</button></form>' +
    '<table class="table"><thead><tr><th>User</th><th>Comment</th><th>Location</th><th>Likes</th><th>Time</th><th></th></tr></thead><tbody>' +
    rows +
    "</tbody></table>" +
    pager;
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

function isIsoText(s: unknown): s is string {
  return typeof s === "string" && !Number.isNaN(Date.parse(s));
}

function parseBackup(raw: unknown, cfg: Config): { pages: db.BackupPage[]; comments: db.BackupComment[]; skipped: number; error: string | null } {
  let skipped = 0;
  const bad = (error: string) => ({ pages: [], comments: [], skipped, error });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return bad("备份格式不正确：应为 Graf 备份对象");
  const obj = raw as Record<string, unknown>;
  if (obj.format !== "graf-backup") return bad("无法识别的备份格式 (format 应为 graf-backup)");
  if (obj.version !== 1) return bad("不支持的备份版本: " + String(obj.version));

  const pages: db.BackupPage[] = [];
  for (const it of Array.isArray(obj.pages) ? (obj.pages as unknown[]) : []) {
    if (!it || typeof it !== "object") { skipped++; continue; }
    const p = it as Record<string, unknown>;
    const path = typeof p.path === "string" ? p.path : "";
    const content = typeof p.content === "string" ? p.content : "";
    if (!validatePath(path) || content.length > cfg.maxPageLength) { skipped++; continue; }
    const created = isIsoText(p.created_at) ? p.created_at : nowIso();
    const views = typeof p.views === "number" && Number.isFinite(p.views) ? Math.max(0, Math.floor(p.views)) : 0;
    pages.push({
      path,
      title: typeof p.title === "string" ? p.title.slice(0, 200) : "",
      author: typeof p.author === "string" ? p.author.slice(0, 100) : "",
      content,
      link_target: p.link_target === "_blank" ? "_blank" : "_self",
      edit_token: typeof p.edit_token === "string" ? p.edit_token.slice(0, 128) : "",
      views,
      created_at: created,
      updated_at: isIsoText(p.updated_at) ? p.updated_at : created,
    });
  }

  const comments: db.BackupComment[] = [];
  for (const it of Array.isArray(obj.comments) ? (obj.comments as unknown[]) : []) {
    if (!it || typeof it !== "object") { skipped++; continue; }
    const cm = it as Record<string, unknown>;
    const siteId = typeof cm.site_id === "string" ? cm.site_id : "";
    const workId = typeof cm.work_id === "string" ? cm.work_id : "";
    const chapterId = typeof cm.chapter_id === "string" ? cm.chapter_id : "";
    const content = typeof cm.content === "string" ? cm.content : "";
    const paraIndex = typeof cm.para_index === "number" ? Math.trunc(cm.para_index) : NaN;
    if (!validateId(siteId) || !validateId(workId) || !validateId(chapterId) || !content || content.length > cfg.maxCommentLength || !Number.isInteger(paraIndex) || paraIndex < 0 || paraIndex > cfg.maxParaIndex) {
      skipped++;
      continue;
    }
    const created = isIsoText(cm.created_at) ? cm.created_at : nowIso();
    comments.push({
      site_id: siteId,
      work_id: workId,
      chapter_id: chapterId,
      para_index: paraIndex,
      content: content.slice(0, cfg.maxCommentLength),
      user_name: typeof cm.user_name === "string" ? cm.user_name.slice(0, 100) : cfg.anonymousName,
      user_id: typeof cm.user_id === "string" ? cm.user_id.slice(0, 128) : null,
      user_avatar: typeof cm.user_avatar === "string" ? cm.user_avatar.slice(0, 255) : null,
      context_text: typeof cm.context_text === "string" ? cm.context_text.slice(0, cfg.maxContextLength) : null,
      likes: typeof cm.likes === "number" && Number.isFinite(cm.likes) ? Math.max(0, Math.floor(cm.likes)) : 0,
      created_at: created,
    });
  }
  return { pages, comments, skipped, error: null };
}

async function importData(c: ReqCtx): Promise<Response> {
  if (c.request.method === "GET") {
    const body =
      "<h1>Import JSON backup</h1>" +
      "<p>POST this page with the backup as the raw JSON body, or run:</p>" +
      "<pre>curl -X POST -H \"Content-Type: application/json\" --cookie \"graf_admin=...\" --data-binary @backup.json " +
      esc(c.cfg.baseUrl || (c.url.origin + "/admin/import")) + "</pre>" +
      "<p>备份格式: { \"format\": \"graf-backup\", \"version\": 1, \"pages\": [...], \"comments\": [...] }。<br>" +
      "导入是原子的：任何一行非法都会整批回滚（合法行先被完整校验）；页面按 path 幂等 upsert，评论按内容去重。" +
      "备份含编辑令牌，请仅在可信网络传输。</p>" +
      '<p><a class="btn btn-sm ghost" href="/admin">Back</a></p>';
    return html(adminShell(c.cfg, "Import", body));
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await c.request.text());
  } catch {
    return html(adminShell(c.cfg, "Import error", '<p class="alert">JSON 解析失败：请上传合法 JSON。</p>'), 400);
  }
  const parsed = parseBackup(raw, c.cfg);
  if (parsed.error) {
    return html(adminShell(c.cfg, "Import error", '<p class="alert">' + esc(parsed.error) + "</p>"), 400);
  }
  try {
    const inserted = await db.importBackup(c.env.DB, parsed.pages, parsed.comments);
    const body =
      "<h1>Import finished</h1>" +
      "<p>本次新增写入: pages <b>" + inserted.pages + "</b>, comments <b>" + inserted.comments + "</b>；" +
      "跳过非法行: <b>" + parsed.skipped + "</b>（重复导入的页面/评论会被幂等合并，不会重复计数）。</p>" +
      "<p>说明: 点赞计数随备份保留，但点赞明细(like_records)不导出，恢复后访客可重新点赞。</p>" +
      '<p><a class="btn btn-sm" href="/admin">Dashboard</a></p>';
    return html(adminShell(c.cfg, "Import", body));
  } catch (e) {
    return html(
      adminShell(c.cfg, "Import error", '<p class="alert">导入失败（已回滚）: ' + esc(e instanceof Error ? e.message : String(e)) + "</p>"),
      400,
    );
  }
}


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
    ["/admin", "看板", "dash"],
    ["/admin/pages", "页面", "pages"],
    ["/admin/comments", "评论", "comments"],
  ];
  if (cfg.enableBooks) links.push(["/admin/books", "作品", "books"]);
  for (const [href, label, key] of links) {
    nav.push('<a href="' + href + '" class="' + (key === active ? "on" : "") + '">' + label + "</a>");
  }
  return layout({
    cfg,
    title: title + " - " + cfg.siteName + " 后台",
    description: "Admin",
    bodyClass: "admin",
    body:
      '<nav class="admin-nav wrap">' + nav.join(" ") +
      '<form method="post" action="/admin/logout" class="inline"><button class="btn btn-sm ghost" type="submit">退出登录</button></form>' +
      "</nav>" +
      '<main class="wrap admin-main">' + body + "</main>" +
      '<script src="/js/admin.js" defer></script>',
  });
}

function loginPage(cfg: Config, message: string | null): string {
  const note = adminEnabled(cfg)
    ? ""
    : '<p class="alert">后台未配置：请先设置 ADMIN_USERNAME / ADMIN_PASSWORD（环境变量或 Secret）。</p>';
  const err = message ? '<p class="alert">' + esc(message) + "</p>" : "";
  return layout({
    cfg,
    title: "后台登录 - " + cfg.siteName,
    description: "Admin login",
    bodyClass: "admin",
    body:
      '<main class="wrap center narrow">' +
      '<h1 class="brand">' + esc(cfg.siteName) + " 后台</h1>" +
      note + err +
      '<form method="post" action="/admin/login" class="stack">' +
      '<input type="text" name="username" placeholder="用户名" autocomplete="username">' +
      '<input type="password" name="password" placeholder="密码" autocomplete="current-password">' +
      '<button class="btn" type="submit">登录</button>' +
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
  if (path === "/admin/books" || path === "/admin/books/") return booksAdmin(c);
  return html(adminShell(c.cfg, "Not found", "<p>未找到。</p>"), 404);
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
      const delForm = '<form class="inline" method="post" action="/admin/actions/delete-page" data-confirm="确定删除该页面？"><input type="hidden" name="path" value="' + esc(p.path) + '"><button class="btn btn-sm danger" type="submit">删除</button></form>';
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
    '<div class="stat"><b>' + pages + "</b><span>页面</span></div>" +
    '<div class="stat"><b>' + comments + "</b><span>评论</span></div>" +
    '<div class="stat"><b>' + accounts + "</b><span>账号</span></div>" +
    "</div>" +
    '<p class="row-end"><a class="btn btn-sm" href="/admin/export">导出 JSON</a> ' +
    '<a class="btn btn-sm ghost" href="/admin/import">导入 JSON</a></p>' +
    '<p class="alert" style="background:#fffbeb;color:#92400e;border-color:#fde68a">备份包含编辑令牌(edit_token)，请安全保存；不含账号 access_token 与访客原始 IP。</p>' +
    "<h2>最近页面</h2>" +
    '<table class="table"><thead><tr><th>Path</th><th>Title</th><th>Author</th><th>Views</th><th>Created</th><th></th></tr></thead><tbody>' +
    rows +
    "</tbody></table>" +
    '<p><a class="btn btn-sm ghost" href="/admin/pages">浏览 / 搜索全部页面</a></p>';
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
      const delForm = '<form class="inline" method="post" action="/admin/actions/delete-page" data-confirm="确定删除该页面？"><input type="hidden" name="path" value="' + esc(p.path) + '"><button class="btn btn-sm danger" type="submit">删除</button></form>';
      return (
        '<tr><td><a href="/' + esc(p.path) + '/">' + esc(p.path) + '</a></td>' +
        '<td>' + esc(p.title || "(untitled)") + '</td>' +
        '<td>' + esc(p.author || "") + '</td>' +
        '<td>' + p.views + '</td>' +
        '<td>' + fmtTime(p.created_at) + '</td>' +
        '<td><a class="btn btn-sm ghost" href="/' + esc(p.path) + '/edit">编辑</a> ' + delForm + '</td></tr>'
      );
    })
    .join("");
  const pager =
    '<p class="row">' +
    (page > 0 ? '<a class="btn btn-sm ghost" href="/admin/pages?q=' + encodeURIComponent(q) + '&p=' + (page - 1) + '">← 上一页</a> ' : "") +
    (hasMore ? '<a class="btn btn-sm ghost" href="/admin/pages?q=' + encodeURIComponent(q) + '&p=' + (page + 1) + '">下一页 →</a>' : "") +
    " <span class=\"dim\">第 " + (page + 1) + " 页（每页 " + PAGE_SIZE + " 条）</span></p>";
  const body =
    '<h1>页面</h1>' +
    '<form method="get" class="row"><input type="search" name="q" value="' + esc(q) + '" placeholder="搜索 path / 标题 / 作者"><input type="hidden" name="p" value="' + page + '"><button class="btn btn-sm" type="submit">Search</button></form>' +
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
      const delForm = '<form class="inline" method="post" action="/admin/actions/delete-comment" data-confirm="确定删除该评论？"><input type="hidden" name="id" value="' + cm.id + '"><button class="btn btn-sm danger" type="submit">删除</button></form>';
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
    (page > 0 ? '<a class="btn btn-sm ghost" href="/admin/comments?siteId=' + encodeURIComponent(siteId) + '&workId=' + encodeURIComponent(workId) + '&p=' + (page - 1) + '">← 上一页</a> ' : "") +
    (hasMore ? '<a class="btn btn-sm ghost" href="/admin/comments?siteId=' + encodeURIComponent(siteId) + '&workId=' + encodeURIComponent(workId) + '&p=' + (page + 1) + '">下一页 →</a>' : "") +
    " <span class=\"dim\">第 " + (page + 1) + " 页（每页 " + PAGE_SIZE + " 条）</span></p>";
  const body =
    '<h1>评论</h1>' +
    '<form method="get" class="row"><input type="text" name="siteId" value="' + esc(siteId) + '" placeholder="siteId"><input type="text" name="workId" value="' + esc(workId) + '" placeholder="workId（页面 path）"><button class="btn btn-sm" type="submit">筛选</button></form>' +
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
      link_target: p.link_target, edit_token: p.edit_token, book_id: p.book_id, order_num: p.order_num, views: p.views,
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
      book_id: typeof p.book_id === "number" && Number.isInteger(p.book_id) && p.book_id > 0 ? p.book_id : null,
      order_num: typeof p.order_num === "number" && Number.isInteger(p.order_num) ? p.order_num : null,
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
      "<h1>导入 JSON 备份</h1>" +
      "<p>POST this page with the backup as the raw JSON body, or run:</p>" +
      "<pre>curl -X POST -H \"Content-Type: application/json\" --cookie \"graf_admin=...\" --data-binary @backup.json " +
      esc(c.cfg.baseUrl || (c.url.origin + "/admin/import")) + "</pre>" +
      "<p>备份格式: { \"format\": \"graf-backup\", \"version\": 1, \"pages\": [...], \"comments\": [...] }。<br>" +
      "导入是原子的：任何一行非法都会整批回滚（合法行先被完整校验）；页面按 path 幂等 upsert，评论按内容去重。" +
      "备份含编辑令牌，请仅在可信网络传输。</p>" +
      '<p><a class="btn btn-sm ghost" href="/admin">返回</a></p>';
    return html(adminShell(c.cfg, "Import", body));
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await c.request.text());
  } catch {
    return html(adminShell(c.cfg, "导入失败", '<p class="alert">JSON 解析失败：请上传合法 JSON。</p>'), 400);
  }
  const parsed = parseBackup(raw, c.cfg);
  if (parsed.error) {
    return html(adminShell(c.cfg, "导入失败", '<p class="alert">' + esc(parsed.error) + "</p>"), 400);
  }
  try {
    const inserted = await db.importBackup(c.env.DB, parsed.pages, parsed.comments);
    const body =
      "<h1>导入完成</h1>" +
      "<p>本次新增写入: pages <b>" + inserted.pages + "</b>, comments <b>" + inserted.comments + "</b>；" +
      "跳过非法行: <b>" + parsed.skipped + "</b>（重复导入的页面/评论会被幂等合并，不会重复计数）。</p>" +
      "<p>说明: 点赞计数随备份保留，但点赞明细(like_records)不导出，恢复后访客可重新点赞。</p>" +
      '<p><a class="btn btn-sm" href="/admin">返回看板</a></p>';
    return html(adminShell(c.cfg, "Import", body));
  } catch (e) {
    return html(
      adminShell(c.cfg, "导入失败", '<p class="alert">导入失败（已回滚）: ' + esc(e instanceof Error ? e.message : String(e)) + "</p>"),
      400,
    );
  }
}
// ---- book (novel site) admin ----
async function booksAdmin(c: ReqCtx): Promise<Response> {
  if (c.request.method === "POST") {
    const form = await c.request.formData().catch(() => null);
    const action = form ? String(form.get("action") || "") : "";
    if (!form) return redir("/admin/books");
    const bookRedirect = String(form.get("book") || "");
    if (action === "create") {
      const title = (form.get("title") || "").toString().trim().slice(0, 200);
      const path = (form.get("path") || "").toString().trim().toLowerCase().slice(0, 64);
      const author = (form.get("author") || "").toString().trim().slice(0, 100);
      const description = (form.get("description") || "").toString().trim().slice(0, 2000);
      if (title && db.BOOK_PATH_RE.test(path)) {
        const existing = await db.bookByPath(c.env.DB, path);
        if (!existing) await db.createBook(c.env.DB, { path, title, author, description, created_at: nowIso() });
      }
    } else if (action === "delete") {
      const path = (form.get("path") || "").toString().trim();
      const book = path ? await db.bookByPath(c.env.DB, path) : null;
      if (book) await db.deleteBook(c.env.DB, book.id);
    } else if (action === "assign") {
      const bookPath = (form.get("book") || "").toString().trim();
      const pagePath = (form.get("pagePath") || "").toString().trim();
      const orderRaw = form.get("order") ? Number(form.get("order")) : NaN;
      const book = bookPath ? await db.bookByPath(c.env.DB, bookPath) : null;
      const page = validatePath(pagePath) ? await db.pageByPath(c.env.DB, pagePath) : null;
      if (book && page) {
        const order = Number.isInteger(orderRaw) && orderRaw >= 0 ? Math.trunc(orderRaw) : null;
        if (order === null) {
          const chapters = await db.pagesByBook(c.env.DB, book.id);
          const maxOrder = chapters.reduce((m, p) => Math.max(m, p.order_num ?? 0), 0);
          await db.assignPageToBook(c.env.DB, page.id, book.id, maxOrder + 1);
        } else {
          await db.assignPageToBook(c.env.DB, page.id, book.id, order);
        }
      }
    } else if (action === "unassign") {
      const pagePath = (form.get("pagePath") || "").toString().trim();
      const page = validatePath(pagePath) ? await db.pageByPath(c.env.DB, pagePath) : null;
      if (page) await db.unassignPageFromBook(c.env.DB, page.id);
    }
    return redir("/admin/books?book=" + encodeURIComponent(bookRedirect));
  }

  const active = c.url.searchParams.get("book") || "";
  const stats = await db.bookStats(c.env.DB);
  const statMap = new Map<number, { n: number; last_update: string }>();
  for (const st of stats) statMap.set(st.book_id, st);
  const books = await db.listBooks(c.env.DB);
  const bodyParts: string[] = [];
  bodyParts.push("<h1>作品管理</h1>");

  if (active) {
    const book = await db.bookByPath(c.env.DB, active);
    if (!book) return html(adminShell(c.cfg, "作品", "<p class=\"alert\">未找到该书。</p>"), 404);
    const chapters = await db.pagesByBook(c.env.DB, book.id);
    const rows = chapters
      .map((p, i) => {
        const order = p.order_num != null ? p.order_num : i + 1;
        const u = '<form class="inline" method="post" action="/admin/books"><input type="hidden" name="action" value="unassign"><input type="hidden" name="book" value="' + esc(book.path) + '"><input type="hidden" name="pagePath" value="' + esc(p.path) + '"><button class="btn btn-sm danger" type="submit">移出</button></form>';
        return "<tr><td>" + order + "</td><td><a href=\"/" + esc(p.path) + "/\">" + esc(p.title || p.path) + "</a></td><td>" + p.content.length + "</td><td>" + u + "</td></tr>";
      })
      .join("");
    bodyParts.push(
      "<h2>" + esc(book.title) + "（" + esc(book.path) + "）· 共 " + chapters.length + " 章</h2>" +
      '<table class="table"><thead><tr><th>序</th><th>章节</th><th>字数</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>" +
      '<h2>添加章节</h2>' +
      '<form method="post" action="/admin/books" class="row"><input type="hidden" name="action" value="assign"><input type="hidden" name="book" value="' + esc(book.path) + '">' +
      '<input type="text" name="pagePath" placeholder="章节页 path（如 Abcdef12）"><input type="number" name="order" placeholder="顺序(可选,留空=末尾)">' +
      '<button class="btn btn-sm" type="submit">加入本书</button></form>' +
      '<p><a class="btn btn-sm ghost" href="/admin/books">← 全部作品</a> <a class="btn btn-sm ghost" href="/book/' + esc(book.path) + '">预览目录</a></p>'
    );
  } else {
    const rows = books
      .map((b) => {
        const st = statMap.get(b.id);
        const n = st ? st.n : 0;
        const del = '<form class="inline" method="post" action="/admin/books" data-confirm="确定删除该书？（章节会移出但不删除页面）"><input type="hidden" name="action" value="delete"><input type="hidden" name="path" value="' + esc(b.path) + '"><button class="btn btn-sm danger" type="submit">删除</button></form>';
        return "<tr><td><a href=\"/admin/books?book=" + encodeURIComponent(b.path) + "\">" + esc(b.title) + "</a></td><td>" + esc(b.path) + "</td><td>" + esc(b.author || "-") + "</td><td>" + n + "</td><td>" + del + "</td></tr>";
      })
      .join("");
    bodyParts.push(
      '<table class="table"><thead><tr><th>书名</th><th>标识</th><th>作者</th><th>章节</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>" +
      '<h2>新建作品</h2>' +
      '<form method="post" action="/admin/books" class="row"><input type="hidden" name="action" value="create">' +
      '<input type="text" name="title" placeholder="书名" required><input type="text" name="path" placeholder="标识(小写字母数字-) 如 my-novel" required>' +
      '<input type="text" name="author" placeholder="作者(可选)"><input type="text" name="description" placeholder="简介(可选)">' +
      '<button class="btn btn-sm" type="submit">创建</button></form>'
    );
  }
  return html(adminShell(c.cfg, "作品", bodyParts.join("\n"), "books"));
}


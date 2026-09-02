// Telegraph-compatible API endpoints (port of tapnote/views.py api_* handlers).
import type { Config } from "./config";
import { json, toBool, str, toInt, plainSnippet, nowIso, readParams, timingSafeEqualStr } from "./util";
import { validatePath, randomPath, newEditToken, newAccessToken } from "./ids";
import { nodesToMarkdown, markdownToNodes } from "./markdown/nodes";
import type { Env } from "./config";
import * as db from "./db";

export interface ApiDeps {
  cfg: Config;
  env: Env;
  origin: string;
  params: Record<string, unknown>;
  request: Request;
}

const bad = (error: string, status = 400) => json({ ok: false, error }, status);
const err = (error: string, status: number) => json({ ok: false, error }, status);

function pageUrl(origin: string, path: string): string {
  return origin + "/" + path + "/";
}

async function findPage(params: Record<string, unknown>, urlPath: string | undefined) {
  const path = str(params.path) || urlPath;
  return path;
}

function parseContent(raw: unknown): { ok: true; value: unknown[] } | { ok: false; error: string } {
  let nodes: unknown;
  if (typeof raw === "string") {
    try {
      nodes = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Content must be a valid JSON string of nodes" };
    }
  } else {
    nodes = raw;
  }
  if (!Array.isArray(nodes)) return { ok: false, error: "Invalid content format" };
  return { ok: true, value: nodes };
}

export async function apiCreateAccount(d: ApiDeps): Promise<Response> {
  if (d.request.method !== "POST") return bad("POST required", 405);
  const shortName = str(d.params.short_name) || "";
  if (!shortName) return bad("SHORT_NAME_REQUIRED");
  if (shortName.length > 32) return bad("SHORT_NAME_TOO_LONG");
  const authorName = str(d.params.author_name) || "Anonymous";
  const authorUrl = str(d.params.author_url) || "";
  const account = await db.createAccount(d.env.DB, {
    short_name: shortName,
    author_name: authorName,
    author_url: authorUrl,
    access_token: newAccessToken(),
    created_at: nowIso(),
  });
  return json({
    ok: true,
    result: {
      short_name: account.short_name,
      author_name: account.author_name,
      author_url: account.author_url,
      access_token: account.access_token,
      auth_url: "",
    },
  });
}

export async function apiGetAccountInfo(d: ApiDeps): Promise<Response> {
  if (d.request.method !== "POST") return bad("POST required", 405);
  const token = str(d.params.access_token) || "";
  if (!token) return bad("ACCESS_TOKEN_REQUIRED");
  const account = await db.accountByToken(d.env.DB, token);
  if (!account) return err("INVALID_ACCESS_TOKEN", 401);

  let fields: unknown = d.params.fields;
  if (typeof fields === "string") {
    try {
      fields = JSON.parse(fields);
    } catch {
      /* keep as-is */
    }
  }
  const list = Array.isArray(fields) ? fields.map(String) : ["short_name", "author_name", "author_url"];
  const result: Record<string, unknown> = {};
  if (list.includes("short_name")) result.short_name = account.short_name;
  if (list.includes("author_name")) result.author_name = account.author_name;
  if (list.includes("author_url")) result.author_url = account.author_url;
  if (list.includes("auth_url")) result.auth_url = "";
  if (list.includes("page_count")) result.page_count = (await db.pagesByAccount(d.env.DB, account.id, 0, 1)).total;
  return json({ ok: true, result });
}

export async function apiRevokeAccessToken(d: ApiDeps): Promise<Response> {
  if (d.request.method !== "POST") return bad("POST required", 405);
  const token = str(d.params.access_token) || "";
  if (!token) return bad("ACCESS_TOKEN_REQUIRED");
  const account = await db.accountByToken(d.env.DB, token);
  if (!account) return err("INVALID_ACCESS_TOKEN", 401);
  const fresh = newAccessToken();
  await db.rotateAccountToken(d.env.DB, account.id, fresh);
  return json({ ok: true, result: { access_token: fresh, auth_url: "" } });
}

export async function apiGetPageList(d: ApiDeps): Promise<Response> {
  if (d.request.method !== "POST") return bad("POST required", 405);
  const token = str(d.params.access_token) || "";
  if (!token) return bad("ACCESS_TOKEN_REQUIRED");
  const account = await db.accountByToken(d.env.DB, token);
  if (!account) return err("INVALID_ACCESS_TOKEN", 401);
  let offset = toInt(d.params.offset) ?? 0;
  let limit = toInt(d.params.limit) ?? 50;
  if (offset < 0) offset = 0;
  if (limit < 1) limit = 1;
  if (limit > 200) limit = 200;
  const { pages, total } = await db.pagesByAccount(d.env.DB, account.id, offset, limit);
  const items = pages.map((p) => {
    const item: Record<string, unknown> = {
      path: p.path,
      url: pageUrl(d.origin, p.path),
      title: p.title,
      description: plainSnippet(p.content, 100),
      views: p.views,
      can_edit: true,
    };
    if (p.author) item.author_name = p.author;
    return item;
  });
  return json({ ok: true, result: { total_count: total, pages: items } });
}

export async function apiGetViews(d: ApiDeps, urlPath?: string): Promise<Response> {
  if (d.request.method !== "POST" && d.request.method !== "GET") return bad("POST required", 405);
  const path = str(d.params.path) || urlPath || "";
  if (!path) return bad("PATH_REQUIRED");
  if (!validatePath(path)) return bad("PATH_REQUIRED");
  const page = await db.pageByPath(d.env.DB, path);
  if (!page) return err("PAGE_NOT_FOUND", 404);
  return json({ ok: true, result: { views: page.views } });
}

export async function apiGetPage(d: ApiDeps, urlPath?: string): Promise<Response> {
  const path = str(d.params.path) || urlPath || "";
  if (!path) return bad("Path is required");
  if (!validatePath(path)) return bad("Path is required");
  const page = await db.pageByPath(d.env.DB, path);
  if (!page) return err("Page not found", 404);
  const returnContent = toBool(d.params.return_content, false);
  const result: Record<string, unknown> = {
    path: page.path,
    url: pageUrl(d.origin, page.path),
    title: page.title,
    description: plainSnippet(page.content, 100),
    views: page.views,
  };
  if (page.author) result.author_name = page.author;
  if (returnContent) result.content = markdownToNodes(page.content);
  return json({ ok: true, result });
}

export async function apiCreatePage(d: ApiDeps): Promise<Response> {
  if (d.request.method !== "POST") return bad("POST required", 405);
  const title = str(d.params.title) || "";
  if (!title) return bad("Title is required");
  const rawContent = d.params.content;
  if (rawContent === undefined || rawContent === null || rawContent === "") return bad("Content is required");
  const parsed = parseContent(rawContent);
  if (!parsed.ok) return bad(parsed.error);
  let authorName = str(d.params.author_name) || "";
  let accountId: number | null = null;
  const token = str(d.params.access_token) || "";
  if (token) {
    const account = await db.accountByToken(d.env.DB, token);
    if (!account) return err("INVALID_ACCESS_TOKEN", 401);
    accountId = account.id;
    if (!authorName) authorName = account.author_name;
  }
  const markdown = nodesToMarkdown(parsed.value as Parameters<typeof nodesToMarkdown>[0]);
  if (markdown.length > d.cfg.maxPageLength) return bad("Content too long");
  const page = await db.createPage(d.env.DB, {
    path: randomPath(),
    title,
    author: authorName,
    content: markdown,
    link_target: "_self",
    edit_token: newEditToken(),
    account_id: accountId,
    created_at: nowIso(),
  });
  const result: Record<string, unknown> = {
    path: page.path,
    url: pageUrl(d.origin, page.path),
    title: page.title,
    description: "",
    views: page.views,
    can_edit: true,
  };
  if (authorName) result.author_name = authorName;
  if (toBool(d.params.return_content, false)) result.content = parsed.value;
  return json({ ok: true, result });
}

export async function apiEditPage(d: ApiDeps, urlPath?: string): Promise<Response> {
  if (d.request.method !== "POST") return bad("POST required", 405);
  const path = str(d.params.path) || urlPath || "";
  const token = str(d.params.access_token) || "";
  const title = str(d.params.title) || "";
  const rawContent = d.params.content;
  if (!path) return bad("PATH_REQUIRED");
  if (!validatePath(path)) return bad("PATH_REQUIRED");
  if (!token) return bad("ACCESS_TOKEN_REQUIRED");
  if (!title) return bad("TITLE_REQUIRED");
  if (rawContent === undefined || rawContent === null || rawContent === "") return bad("CONTENT_REQUIRED");

  const account = await db.accountByToken(d.env.DB, token);
  if (!account) return err("INVALID_ACCESS_TOKEN", 401);
  const page = await db.pageByPath(d.env.DB, path);
  if (!page) return err("PAGE_NOT_FOUND", 404);
  if (page.account_id !== account.id) return err("PERMISSION_DENIED", 403);

  const parsed = parseContent(rawContent);
  if (!parsed.ok) return bad(parsed.error);
  const markdown = nodesToMarkdown(parsed.value as Parameters<typeof nodesToMarkdown>[0]);
  if (markdown.length > d.cfg.maxPageLength) return bad("Content too long");

  const authorName = str(d.params.author_name);
  await db.updatePageContent(d.env.DB, page.id, {
    title,
    author: authorName ?? page.author,
    content: markdown,
    link_target: page.link_target,
    updated_at: nowIso(),
  });
  const updated = (await db.pageById(d.env.DB, page.id))!;
  const result: Record<string, unknown> = {
    path: updated.path,
    url: pageUrl(d.origin, updated.path),
    title: updated.title,
    description: "",
    views: updated.views,
  };
  if (updated.author) result.author_name = updated.author;
  if (toBool(d.params.return_content, false)) result.content = parsed.value;
  return json({ ok: true, result });
}

export async function isPageAuthor(d: ApiDeps, path: string): Promise<boolean> {
  const page = await db.pageByPath(d.env.DB, path);
  if (!page) return false;
  const cookieToken = cookieValue(d.request, "edit_token_" + page.path);
  const bodyToken = str(d.params.editToken) || str(d.params.edit_token);
  const urlToken = str(d.params.token);
  const candidates = [cookieToken, bodyToken, urlToken].filter((t): t is string => !!t);
  for (const c of candidates) {
    if (await timingSafeEqualStr(c, page.edit_token)) return true;
  }
  return false;
}

function cookieValue(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return null;
}

export async function routeTelegraphApi(
  cfg: Config,
  env: Env,
  request: Request,
  url: URL,
  name: string,
  urlPath: string | undefined,
): Promise<Response> {
  const params = await readParams(request);
  const origin = cfg.baseUrl || url.origin;
  const deps: ApiDeps = { cfg, env, origin, params, request };
  switch (name) {
    case "createAccount":
      return apiCreateAccount(deps);
    case "getAccountInfo":
      return apiGetAccountInfo(deps);
    case "revokeAccessToken":
      return apiRevokeAccessToken(deps);
    case "getPageList":
      return apiGetPageList(deps);
    case "getViews":
      return apiGetViews(deps, urlPath);
    case "getPage":
      return apiGetPage(deps, urlPath);
    case "createPage":
      return apiCreatePage(deps);
    case "editPage":
      return apiEditPage(deps, urlPath);
    default:
      return bad("UNKNOWN_METHOD");
  }
}

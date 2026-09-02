// Graf - Cloudflare Worker entrypoint.
import type { Env } from "./config";
import { loadConfig } from "./config";
import { json } from "./util";
import { routeTelegraphApi } from "./telegraph";
import { routeCommentApi } from "./comments";
import { homePage, publishPage, viewPage, editPageWeb, notFoundHtml } from "./web";
import { routeAdmin } from "./admin";

const STATIC_PREFIXES = ["/css/", "/js/", "/favicon.ico", "/robots.txt"];

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "media-src 'self' https: data:",
    "font-src 'self' data:",
    "frame-src https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; "),
};

function withSecurity(res: Response): Response {
  const out = new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!out.headers.has(k)) out.headers.set(k, v);
  }
  if (!out.headers.has("cache-control")) out.headers.set("cache-control", "no-store");
  return out;
}

const TELEGRAPH_API: Record<string, boolean> = {
  createAccount: true,
  getAccountInfo: true,
  revokeAccessToken: true,
  getPageList: true,
  getViews: true,
  getPage: true,
  createPage: true,
  editPage: true,
};

function splitSegments(p: string): string[] {
  return p.split("/").filter((s) => s.length > 0);
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const cfg = loadConfig(env);
  const method = request.method;

  // static assets (workers static assets binding)
  for (const prefix of STATIC_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix)) {
      const asset = await env.ASSETS.fetch(request).catch(() => null);
      if (asset && asset.status !== 404) return withSecurity(asset);
      break;
    }
  }

  const segs = splitSegments(pathname);
  const first = segs[0] || "";

  // ---- admin ----
  if (first === "admin") {
    return withSecurity(await routeAdmin({ cfg, env, request, url }));
  }

  // ---- ParaNote-compatible comment APIs ----
  if (first === "api" && segs[1] === "v1") {
    const action = segs[2];
    if (action === "comments" && segs[3] === "like") return withSecurity(await routeCommentApi(cfg, env, request, url, "like"));
    if (action === "comments") return withSecurity(await routeCommentApi(cfg, env, request, url, "comments"));
    if (action === "ban") return withSecurity(await routeCommentApi(cfg, env, request, url, "ban"));
    return withSecurity(json({ ok: false, error: "PAGE_NOT_FOUND" }, 404));
  }

  // ---- Telegraph-compatible API ----
  if (TELEGRAPH_API[first]) {
    const apiPath = segs.length > 1 ? segs.slice(1).join("/") : undefined;
    return withSecurity(await routeTelegraphApi(cfg, env, request, url, first, apiPath));
  }

  // ---- web pages ----
  if (first === "") {
    if (method === "GET") return withSecurity(await homePage({ cfg, env, request, url }));
    return withSecurity(json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405));
  }
  if (first === "publish") {
    if (method === "POST" || method === "GET") return withSecurity(await publishPage({ cfg, env, request, url }));
    return withSecurity(json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405));
  }

  // note pages: /{path}, /{path}/, /{path}/edit
  const pagePath = segs[0]!;
  const rest = segs[1];
  if (rest === undefined || rest === "") {
    if (method === "GET") return withSecurity(await viewPage({ cfg, env, request, url }, pagePath));
    return withSecurity(json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405));
  }
  if (rest === "edit" && segs.length === 2) {
    return withSecurity(await editPageWeb({ cfg, env, request, url }, pagePath));
  }

  // unknown API-ish paths -> JSON 404; everything else -> HTML 404
  if (pathname.startsWith("/api/") || TELEGRAPH_API[pagePath]) {
    return withSecurity(json({ ok: false, error: "PAGE_NOT_FOUND" }, 404));
  }
  return withSecurity(notFoundHtml(cfg));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (e) {
      console.error("graf error", e);
      return json({ ok: false, error: "internal_error" }, 500);
    }
  },
};

// export route for tests
export { route };

// Route-level harness: boots the worker route() with a fresh SQLite DB per test.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SqliteD1 } from "./sqlite-d1";
import type { Env } from "../../src/config";
import { route } from "../../src/index";

export const TEST_ORIGIN = "http://graf.test";
export const TEST_SECRET = "0123456789abcdef0123456789abcdef";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export interface HarnessOptions {
  env?: Partial<Env>;
  siteName?: string;
}

export function applyMigrations(db: SqliteD1): void {
  const dir = path.resolve(HERE, "../../migrations");
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  for (const f of files) {
    db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  }
}

export class Harness {
  db: SqliteD1;
  env: Env;
  constructor(opts: HarnessOptions = {}) {
    this.db = new SqliteD1(":memory:");
    applyMigrations(this.db);
    this.env = {
      DB: this.db as unknown as D1Database,
      ASSETS: {
        fetch: async (req: Request | string) => {
          const url = typeof req === "string" ? req : req.url;
          if (/favicon|robots/.test(url)) return new Response("ok");
          if (/\.(css|js)$/.test(url)) {
            return new Response("/* static */", {
              headers: { "content-type": url.endsWith(".css") ? "text/css" : "application/javascript" },
            });
          }
          return new Response("not found", { status: 404 });
        },
      } as unknown as Fetcher,
      SECRET: TEST_SECRET,
      SITE_NAME: opts.siteName || "Graf",
      SITE_ID: "default",
      ENABLE_COMMENTS: "true",
      MAX_PAGE_LENGTH: "200000",
      CACHE_TTL: "0",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "s3cret",
      ...(opts.env || {}),
    };
  }
  close(): void {
    this.db.close();
  }
}

export interface ReqOpts {
  method?: string;
  path: string;
  body?: string | URLSearchParams | Record<string, unknown>;
  headers?: Record<string, string>;
  cookie?: string;
  origin?: string;
}

export async function call(h: Harness, opts: ReqOpts): Promise<Response> {
  const method = opts.method || "GET";
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.cookie) headers["cookie"] = opts.cookie;
  let body: string | undefined;
  if (typeof opts.body === "string") body = opts.body;
  else if (opts.body instanceof URLSearchParams) {
    headers["content-type"] = headers["content-type"] || "application/x-www-form-urlencoded";
    body = opts.body.toString();
  } else if (opts.body !== undefined) {
    headers["content-type"] = headers["content-type"] || "application/json";
    body = JSON.stringify(opts.body);
  }
  const origin = opts.origin || TEST_ORIGIN;
  headers["host"] = new URL(origin).host;
  if (!headers["cf-connecting-ip"] && !headers["x-forwarded-for"]) {
    headers["cf-connecting-ip"] = "203.0.113.7"; // simulate Cloudflare runtime
  }
  const unsafe = method === "POST" || method === "DELETE" || method === "PUT" || method === "PATCH";
  if (unsafe && opts.headers?.["sec-fetch-site"] === undefined && opts.headers?.["origin"] === undefined) {
    headers["origin"] = origin;
    headers["sec-fetch-site"] = "same-origin";
  }
  const req = new Request(new URL(opts.path, origin).toString(), { method, headers, body, redirect: "manual" });
  return route(req, h.env);
}

export function cookieOf(res: Response, name: string): string | null {
  const set = res.headers.get("set-cookie");
  if (!set) return null;
  const m = set.match(new RegExp("(?:^|,\\s*)" + name + "=([^;]*)"));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return m[1]!;
  }
}

export async function jsonOf(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

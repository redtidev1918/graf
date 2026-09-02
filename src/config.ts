// Graf runtime configuration: parse environment variables with defaults.
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SECRET?: string;
  SITE_NAME?: string;
  SITE_ID?: string;
  BASE_URL?: string;
  ENABLE_COMMENTS?: string;
  MAX_PAGE_LENGTH?: string;
  CACHE_TTL?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
}

export interface Config {
  siteName: string;
  siteId: string;
  baseUrl: string | null;
  secret: string;
  enableComments: boolean;
  maxPageLength: number;
  cacheTtlSeconds: number;
  adminUsername: string | null;
  adminPassword: string | null;
  commentGuestPrefix: string;
  anonymousName: string;
  maxCommentsPerMinute: number;
  maxCommentLength: number;
  maxContextLength: number;
  maxParaIndex: number;
}

function envBool(v: string | undefined, def: boolean): boolean {
  if (v === undefined || v === "") return def;
  return !["0", "false", "no", "off", "disabled"].includes(v.toLowerCase());
}

function envInt(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
}

export function loadConfig(env: Env): Config {
  const secret = env.SECRET?.trim() || "";
  const base = env.BASE_URL?.trim() || "";
  return {
    siteName: env.SITE_NAME?.trim() || "Graf",
    siteId: env.SITE_ID?.trim() || "default",
    baseUrl: base.replace(/\/+$/, "") || null,
    secret,
    enableComments: envBool(env.ENABLE_COMMENTS, true),
    maxPageLength: envInt(env.MAX_PAGE_LENGTH, 200_000),
    cacheTtlSeconds: envInt(env.CACHE_TTL, 0),
    adminUsername: env.ADMIN_USERNAME?.trim() || null,
    adminPassword: env.ADMIN_PASSWORD || null,
    commentGuestPrefix: "Guest-",
    anonymousName: "Anonymous",
    maxCommentsPerMinute: 10,
    maxCommentLength: 10_000,
    maxContextLength: 100,
    maxParaIndex: 100_000,
  };
}

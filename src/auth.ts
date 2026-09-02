// Admin session (signed cookie) + HMAC-derived anonymous visitor identity.
import { json, timingSafeEqualStr } from "./util";
import type { Config } from "./config";

const enc = new TextEncoder();

async function hmacHex(key: string, data: string): Promise<string> {
  const keyBuf = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", keyBuf, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

/** Stable anonymous identity derived from IP+siteId (HMAC; cannot be reversed to the raw IP). */
export async function commentUserId(ip: string, siteId: string, secret: string): Promise<string> {
  const hex = await hmacHex(secret, "comment-identity\n" + siteId + "\n" + ip);
  return "ip_" + hex.slice(0, 16);
}

export const ADMIN_COOKIE = "graf_admin";
const SESSION_TTL = 7 * 86400;

export interface Session { username: string; }

/** Issue an admin session cookie value (HMAC-signed payload, 7 days). */
export async function signSession(cfg: Config, username: string): Promise<string> {
  const payload = { u: username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = await hmacHex("session:" + cfg.secret, body);
  return body + "." + sig;
}

/** Verify an admin session cookie; returns the session or null. */
export async function verifySession(cfg: Config, cookie: string | null | undefined): Promise<Session | null> {
  if (!cookie || !cfg.secret) return null;
  const dot = cookie.lastIndexOf(".");
  if (dot <= 0 || dot >= cookie.length - 1) return null;
  const body = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expect = await hmacHex("session:" + cfg.secret, body);
  if (!(await timingSafeEqualStr(sig, expect))) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body)) as { u?: unknown; exp?: unknown };
    if (typeof payload.u !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now() / 1000) return null;
    return { username: payload.u };
  } catch {
    return null;
  }
}

export function getCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      try { return decodeURIComponent(part.slice(eq + 1).trim()); } catch { return part.slice(eq + 1).trim(); }
    }
  }
  return null;
}

export function setCookieValue(name: string, value: string, opts: { path?: string; maxAge?: number; httpOnly?: boolean; secure?: boolean }): string {
  const parts = [name + "=" + encodeURIComponent(value), "Path=" + (opts.path || "/")];
  if (opts.maxAge !== undefined) parts.push("Max-Age=" + opts.maxAge);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  parts.push("SameSite=Lax");
  return parts.join("; ");
}

export function clearCookie(name: string, path = "/"): string {
  return name + "=; Path=" + path + "; Max-Age=0; SameSite=Lax";
}

export function adminEnabled(cfg: Config): boolean {
  return !!cfg.adminUsername && !!cfg.adminPassword;
}

export async function checkAdminLogin(cfg: Config, username: string, password: string): Promise<boolean> {
  if (!adminEnabled(cfg)) return false;
  const uOk = await timingSafeEqualStr(username, cfg.adminUsername!);
  const pOk = await timingSafeEqualStr(password, cfg.adminPassword!);
  return uOk && pOk;
}

export function forbiddenJson(): Response {
  return json({ ok: false, error: "permission_denied" }, 403);
}

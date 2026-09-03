// Shared helpers: body parsing / booleans / JSON responses / escaping / IP.
export function readParams(req: Request): Promise<Record<string, unknown>> {
  return (async () => {
    const ct = req.headers.get("content-type") || "";
    try {
      if (ct.includes("application/json")) {
        const j = (await req.json()) as unknown;
        if (j && typeof j === "object" && !Array.isArray(j)) return j as Record<string, unknown>;
        return {};
      }
      if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
        const fd = await req.formData();
        const out: Record<string, unknown> = {};
        fd.forEach((v, k) => { out[k] = v; });
        return out;
      }
    } catch {
      /* ignore parse errors */
    }
    return {};
  })();
}

/** Lenient boolean coercion compatible with "true"/"1"/"yes"/"on". */
export function toBool(v: unknown, def = false): boolean {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return def;
}

export function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return typeof v === "string" ? v : String(v);
}

export function toInt(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** HTML escape */
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain-text snippet from markdown (strips images/headings/emphasis). */
export function plainSnippet(md: string, max = 100): string {
  const clean = md
    .replace(/!\[.*?\]\([^)\s]+\)/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[#*_~>|\-]{1,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

/** First image URL in the markdown (for og:image). */
export function firstImage(md: string): string | null {
  const re = /!\[.*?\]\(([^)\s]+)\)|<img\s+[^>]*src=["']([^"']+)["']/;
  const m = md.match(re);
  const v = m ? m[1] || m[2] : undefined;
  return v || null;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDateIso(s: string): string {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function clientIp(request: Request): string | null {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = request.headers.get("x-real-ip");
  return real ? real.trim() : null;
}

/** CSRF-ish guard: reject obvious cross-site requests for cookie-authenticated mutations. */
export function sameOriginOk(request: Request, url: URL): boolean {
  const sfs = request.headers.get("sec-fetch-site");
  if (sfs) return sfs !== "cross-site";
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser client (curl / bots) — no ambient cookies
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}

/** Constant-time string comparison to avoid timing side channels. */
export async function timingSafeEqualStr(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.byteLength !== bb.byteLength) return false;
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const ha = new Uint8Array(await crypto.subtle.digest("SHA-256", concatBytes(salt, ba)));
  const hb = new Uint8Array(await crypto.subtle.digest("SHA-256", concatBytes(salt, bb)));
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i]! ^ hb[i]!;
  return diff === 0;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

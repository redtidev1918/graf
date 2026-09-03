// Admin: auth, open-redirect, CSRF, throttle, pagination, actions, backup basics.
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Harness, call, jsonOf, cookieOf } from "../helpers/harness";
import { __resetLoginAttempts } from "../../src/admin";

let h: Harness;
beforeEach(() => {
  h = new Harness();
  __resetLoginAttempts();
  return () => h.close();
});
afterEach(() => __resetLoginAttempts());

async function q<T = Record<string, unknown>>(sql: string, ...p: unknown[]): Promise<T[]> {
  const r = await h.db.prepare(sql).bind(...p).all<T>();
  return r.results;
}

async function login(cookieOnly = true): Promise<string> {
  const res = await call(h, { method: "POST", path: "/admin/login", body: new URLSearchParams({ username: "admin", password: "s3cret" }) });
  expect(res.status).toBe(303);
  const v = cookieOf(res, "graf_admin");
  expect(v).toBeTruthy();
  return cookieOnly ? "graf_admin=" + (v as string) : (v as string);
}

describe("login & session", () => {
  it("login sets a cookie and grants /admin access", async () => {
    const cookie = await login();
    const dash = await call(h, { path: "/admin", cookie });
    expect(dash.status).toBe(200);
    expect(await dash.text()).toContain("最近页面");
  });
  it("redirects anonymous visitors to the login page", async () => {
    const res = await call(h, { path: "/admin/pages" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/admin/login?next=");
  });
  it("logs out by clearing the session cookie (stateless HMAC session)", async () => {
    const cookie = await login();
    const out = await call(h, { method: "POST", path: "/admin/logout", cookie });
    expect(out.status).toBe(303);
    const set = out.headers.get("set-cookie") || "";
    expect(set).toContain("graf_admin=;");
    expect(set).toContain("Max-Age=0");
    // The session is stateless (HMAC-signed): replaying an old cookie still validates.
    // Clearing the cookie on the client is the expected logout semantics.
  });
});

describe("open redirect protection", () => {
  it("allows local /admin next", async () => {
    const res = await call(h, { method: "POST", path: "/admin/login?next=/admin/pages", body: new URLSearchParams({ username: "admin", password: "s3cret" }) });
    expect(res.headers.get("location")).toBe("/admin/pages");
  });
  it("rejects https://evil.com, //evil.com and non-admin paths", async () => {
    for (const nxt of ["https://evil.com", "//evil.com", "/outside", "\\evil.com"]) {
      const res = await call(h, { method: "POST", path: "/admin/login?next=" + encodeURIComponent(nxt), body: new URLSearchParams({ username: "admin", password: "s3cret" }) });
      expect(res.headers.get("location")).toBe("/admin");
    }
  });
});

describe("admin CSRF origin guard", () => {
  it("accepts same-origin mutations", async () => {
    const cookie = await login();
    const res = await call(h, { method: "POST", path: "/admin/actions/delete-page", body: new URLSearchParams({ path: "AAAAAAAA" }), cookie });
    expect(res.status).toBe(303);
  });
  it("rejects cross-site mutations with a session cookie", async () => {
    const cookie = await login();
    const res = await call(h, {
      method: "POST",
      path: "/admin/actions/delete-page",
      body: new URLSearchParams({ path: "AAAAAAAA" }),
      cookie,
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    });
    expect(res.status).toBe(403);
  });
});

describe("login throttle", () => {
  it("locks after several failed attempts", async () => {
    for (let i = 0; i < 5; i++) {
      await call(h, { method: "POST", path: "/admin/login", body: new URLSearchParams({ username: "admin", password: "wrong" }) });
    }
    const blocked = await call(h, { method: "POST", path: "/admin/login", body: new URLSearchParams({ username: "admin", password: "wrong" }) });
    expect(blocked.status).toBe(429);
    // even a correct password is refused while locked
    const also = await call(h, { method: "POST", path: "/admin/login", body: new URLSearchParams({ username: "admin", password: "s3cret" }) });
    expect(also.status).toBe(429);
    __resetLoginAttempts();
  });
});

describe("page & comment actions", () => {
  it("delete page removes page, comments and likes (no orphans)", async () => {
    // publish -> comment -> like
    const pub = await call(h, { method: "POST", path: "/publish", body: new URLSearchParams({ content: "body" }) });
    const path = new URL(pub.headers.get("location") || "", "http://x").pathname.replace(/\//g, "");
    const editCookie = "edit_token_" + path + "=" + (cookieOf(pub, "edit_token_" + path) || "");
    const c = await call(h, { method: "POST", path: "/api/v1/comments", body: { siteId: "default", workId: path, chapterId: "main", paraIndex: 0, content: "c" } });
    const cid = ((await jsonOf(c)) as { id: number }).id;
    await call(h, { method: "POST", path: "/api/v1/comments/like", body: { siteId: "default", commentId: cid } });
    // sanity: comment exists
    let row = await q<{ n: number }>("SELECT COUNT(*) AS n FROM comments WHERE work_id = ?", path);
    expect(row[0]!.n).toBe(1);
    const admin = await login();
    const del = await call(h, { method: "POST", path: "/admin/actions/delete-page", body: new URLSearchParams({ path }), cookie: admin });
    expect(del.status).toBe(303);
    row = await q<{ n: number }>("SELECT COUNT(*) AS n FROM comments");
    const likes = await q<{ n: number }>("SELECT COUNT(*) AS n FROM like_records");
    const pages = await q<{ n: number }>("SELECT COUNT(*) AS n FROM pages WHERE path = ?", path);
    expect(row[0]!.n).toBe(0);
    expect(likes[0]!.n).toBe(0);
    expect(pages[0]!.n).toBe(0);
  });
  it("export excludes raw IPs and includes an edit_token credential warning", async () => {
    const pub = await call(h, { method: "POST", path: "/publish", body: new URLSearchParams({ content: "body" }) });
    const path = new URL(pub.headers.get("location") || "", "http://x").pathname.replace(/\//g, "");
    await call(h, { method: "POST", path: "/api/v1/comments", body: { siteId: "default", workId: path, chapterId: "main", paraIndex: 0, content: "c" } });
    const cookie = await login();
    const dash = await call(h, { path: "/admin", cookie });
    expect(await dash.text()).toContain("备份包含编辑令牌");
    const exp = await call(h, { path: "/admin/export", cookie });
    const data = (await exp.json()) as { format: string; pages: Array<Record<string, unknown>>; comments: Array<Record<string, unknown>> };
    expect(data.format).toBe("graf-backup");
    const ipLeak = JSON.stringify(data).match(/"ip"s*:/);
    expect(ipLeak).toBeNull();
    expect(typeof data.pages[0]!.edit_token).toBe("string");
  });
  it("pages list paginates and search respects page param", async () => {
    const cookie = await login();
    for (let i = 0; i < 3; i++) await call(h, { method: "POST", path: "/publish", body: new URLSearchParams({ content: "p" + i }) });
    const p1 = await call(h, { path: "/admin/pages?p=0", cookie });
    expect(p1.status).toBe(200);
    const text1 = await p1.text();
    expect(text1).toContain("第 1 页");
    const q = await call(h, { path: "/admin/pages?q=notfound", cookie });
    expect(await q.text()).toContain("notfound");
  });
});

describe("import validation & idempotency", () => {
  it("rejects malformed / non-graf payloads and applies nothing", async () => {
    const cookie = await login();
    const bad = await call(h, { method: "POST", path: "/admin/import", body: JSON.stringify({ hello: 1 }), cookie });
    expect(bad.status).toBe(400);
    const okShape = await call(h, { method: "POST", path: "/admin/import", body: JSON.stringify({ format: "graf-backup", version: 99, pages: [], comments: [] }), cookie });
    expect(okShape.status).toBe(400);
    const pages = await q<{ n: number }>("SELECT COUNT(*) AS n FROM pages");
    expect(pages[0]!.n).toBe(0);
  });
  it("duplicate import is idempotent for pages and comments", async () => {
    const cookie = await login();
    const backup = {
      format: "graf-backup",
      version: 1,
      pages: [{ path: "Abcdef12", title: "Imported", author: "Me", content: "hello", link_target: "_self", edit_token: "tok123", views: 0, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }],
      comments: [{ site_id: "default", work_id: "Abcdef12", chapter_id: "main", para_index: 0, content: "hi", user_name: "Guest-x", user_id: "ip_abcd", user_avatar: null, context_text: null, likes: 0, created_at: "2026-01-01T00:00:01.000Z" }],
    };
    const body = JSON.stringify(backup);
    await call(h, { method: "POST", path: "/admin/import", body, cookie });
    const again = await call(h, { method: "POST", path: "/admin/import", body, cookie });
    expect(again.status).toBe(200);
    const pages = await q<{ n: number }>("SELECT COUNT(*) AS n FROM pages");
    const comments = await q<{ n: number }>("SELECT COUNT(*) AS n FROM comments");
    expect(pages[0]!.n).toBe(1);
    expect(comments[0]!.n).toBe(1);
  });
});
// Telegraph-compatible API contract tests (run against real SQLite via the route layer).
import { describe, expect, it, beforeEach } from "vitest";
import { Harness, call, jsonOf, TEST_ORIGIN } from "../helpers/harness";

let h: Harness;
beforeEach(() => {
  h = new Harness();
  return () => h.close();
});

async function createAccount(): Promise<string> {
  const res = await call(h, { method: "POST", path: "/createAccount", body: { short_name: "tester", author_name: "Tester" } });
  const j = await jsonOf(res);
  return (j.result as { access_token: string }).access_token;
}

async function createPage(token: string | null, over: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    title: "My Page",
    content: JSON.stringify([{ tag: "p", children: ["Hello World"] }]),
    ...(token ? { access_token: token } : {}),
    ...over,
  };
  const res = await call(h, { method: "POST", path: "/createPage", body });
  return jsonOf(res);
}

describe("createAccount", () => {
  it("creates an account and returns a long token", async () => {
    const res = await call(h, { method: "POST", path: "/createAccount", body: { short_name: "demo" } });
    expect(res.status).toBe(200);
    const j = await jsonOf(res);
    expect(j.ok).toBe(true);
    const r = j.result as { short_name: string; author_name: string; access_token: string; auth_url: string };
    expect(r.short_name).toBe("demo");
    expect(r.author_name).toBe("Anonymous");
    expect(r.access_token.length).toBe(64);
    expect(r.auth_url).toBe("");
  });
  it("rejects missing short_name", async () => {
    const res = await call(h, { method: "POST", path: "/createAccount", body: {} });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toBe("SHORT_NAME_REQUIRED");
  });
  it("rejects an over-long short_name", async () => {
    const res = await call(h, { method: "POST", path: "/createAccount", body: { short_name: "x".repeat(64) } });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toBe("SHORT_NAME_TOO_LONG");
  });
  it("rejects non-POST", async () => {
    const res = await call(h, { method: "GET", path: "/createAccount" });
    expect(res.status).toBe(405);
  });
});

describe("getAccountInfo", () => {
  it("returns fields for a valid token incl page_count", async () => {
    const token = await createAccount();
    await createPage(token);
    const res = await call(h, { method: "POST", path: "/getAccountInfo", body: { access_token: token, fields: JSON.stringify(["short_name", "page_count"]) } });
    const j = await jsonOf(res);
    expect(j.ok).toBe(true);
    const r = j.result as { short_name: string; page_count: number };
    expect(r.short_name).toBe("tester");
    expect(r.page_count).toBe(1);
  });
  it("rejects invalid token", async () => {
    const res = await call(h, { method: "POST", path: "/getAccountInfo", body: { access_token: "bad".repeat(22) } });
    expect(res.status).toBe(401);
    expect((await jsonOf(res)).error).toBe("INVALID_ACCESS_TOKEN");
  });
  it("rejects a missing token", async () => {
    const res = await call(h, { method: "POST", path: "/getAccountInfo", body: {} });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toBe("ACCESS_TOKEN_REQUIRED");
  });
});

describe("revokeAccessToken", () => {
  it("invalidates the old token and makes the new one usable", async () => {
    const token = await createAccount();
    const res = await call(h, { method: "POST", path: "/revokeAccessToken", body: { access_token: token } });
    const j = await jsonOf(res);
    expect(j.ok).toBe(true);
    const fresh = (j.result as { access_token: string }).access_token;
    expect(fresh).not.toBe(token);
    const old = await call(h, { method: "POST", path: "/getAccountInfo", body: { access_token: token } });
    expect(old.status).toBe(401);
    const neu = await call(h, { method: "POST", path: "/getAccountInfo", body: { access_token: fresh } });
    expect(neu.status).toBe(200);
  });
});

describe("createPage / getPage / getViews", () => {
  it("creates without an account and returns can_edit", async () => {
    const j = await createPage(null);
    expect(j.ok).toBe(true);
    const r = j.result as Record<string, unknown>;
    expect(typeof r.path).toBe("string");
    expect(r.can_edit).toBe(true);
    expect(r.views).toBe(0);
  });
  it("fails without title", async () => {
    const res = await call(h, { method: "POST", path: "/createPage", body: { content: "[]" } });
    expect(res.status).toBe(400);
  });
  it("fails on malformed node JSON", async () => {
    const res = await call(h, { method: "POST", path: "/createPage", body: { title: "x", content: "{nope" } });
    expect(res.status).toBe(400);
  });
  it("rejects malformed deep content", async () => {
    const deep = { tag: "p", children: [{ tag: "p", children: [] }] };
    let node: Record<string, unknown> = deep;
    for (let i = 0; i < 20; i++) node = { tag: "p", children: [node] };
    const res = await call(h, { method: "POST", path: "/createPage", body: { title: "deep", content: JSON.stringify([node]) } });
    expect(res.status).toBe(400);
  });
  it("rejects over-long titles", async () => {
    const res = await call(h, { method: "POST", path: "/createPage", body: { title: "t".repeat(300), content: "[]" } });
    expect(res.status).toBe(400);
  });
  it("getPage returns real views and does not increment them; HTML view increments", async () => {
    const created = await createPage(null);
    const path = (created.result as { path: string }).path;
    const g1 = await call(h, { method: "POST", path: "/getViews", body: { path } });
    expect(((await jsonOf(g1)).result as { views: number }).views).toBe(0);
    // API reads do not count
    await call(h, { path: "/getPage/" + path, headers: { "sec-fetch-site": "same-origin" } });
    const g2 = await call(h, { method: "GET", path: "/getViews/" + path });
    expect(((await jsonOf(g2)).result as { views: number }).views).toBe(0);
    // real browser GET does
    await call(h, { path: "/" + path + "/" });
    const g3 = await call(h, { method: "GET", path: "/getViews/" + path });
    expect(((await jsonOf(g3)).result as { views: number }).views).toBe(1);
  });
  it("return_content=true gives back nodes", async () => {
    const j = await createPage(null, { return_content: true });
    const r = j.result as { content?: unknown[] };
    expect(Array.isArray(r.content)).toBe(true);
  });
  it("getPage 404s for a missing page", async () => {
    const res = await call(h, { path: "/getPage/AAAAAAAA/" });
    expect(res.status).toBe(404);
  });
});

describe("editPage", () => {
  it("owner can edit; other account cannot", async () => {
    const t1 = await createAccount();
    const t2 = await createAccount();
    const created = await createPage(t1);
    const path = (created.result as { path: string }).path;
    const edit = await call(h, {
      method: "POST",
      path: "/editPage/" + path,
      body: { access_token: t1, title: "New", content: JSON.stringify([{ tag: "p", children: ["Edited"] }]), return_content: true },
    });
    expect(edit.status).toBe(200);
    expect(((await jsonOf(edit)).result as { title: string }).title).toBe("New");
    const denied = await call(h, {
      method: "POST",
      path: "/editPage/" + path,
      body: { access_token: t2, title: "Hacked", content: "[]" },
    });
    expect(denied.status).toBe(403);
    const noch = await call(h, {
      method: "POST",
      path: "/editPage/" + path,
      body: { title: "No token", content: "[]" },
    });
    expect(noch.status).toBe(400);
    const missing = await call(h, {
      method: "POST",
      path: "/editPage/AAAAAAAA",
      body: { access_token: t1, title: "x", content: "[]" },
    });
    expect(missing.status).toBe(404);
  });
});

describe("getPageList", () => {
  it("paginates newest-first with total_count", async () => {
    const token = await createAccount();
    for (let i = 0; i < 3; i++) await createPage(token, { title: "P" + i });
    const res = await call(h, { method: "POST", path: "/getPageList", body: { access_token: token, offset: 0, limit: 2 } });
    const j = await jsonOf(res);
    const r = j.result as { total_count: number; pages: Array<{ title: string }> };
    expect(r.total_count).toBe(3);
    expect(r.pages.length).toBe(2);
    expect(r.pages[0]!.title).toBe("P2"); // newest first
    const res2 = await call(h, { method: "POST", path: "/getPageList", body: { access_token: token, offset: 2, limit: 2 } });
    const j2 = await jsonOf(res2);
    expect(((j2.result as { pages: unknown[] }).pages).length).toBe(1);
  });
  it("clamps the limit", async () => {
    const token = await createAccount();
    const res = await call(h, { method: "POST", path: "/getPageList", body: { access_token: token, limit: 9999 } });
    expect(((await jsonOf(res)).result as { pages: unknown[] }).pages.length).toBeLessThanOrEqual(200);
  });
});

describe("form-encoded bodies & origin link building", () => {
  it("accepts urlencoded posts (TelePress style)", async () => {
    const res = await call(h, {
      method: "POST",
      path: "/createAccount",
      body: new URLSearchParams({ short_name: "formuser" }),
    });
    expect(res.status).toBe(200);
  });
  it("builds absolute urls from the request origin", async () => {
    const j = await createPage(null);
    const url = (j.result as { url: string }).url;
    expect(url.startsWith(TEST_ORIGIN + "/")).toBe(true);
  });
});

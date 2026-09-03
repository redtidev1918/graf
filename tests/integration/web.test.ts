// Web publishing flows, edit-token semantics, view counting, HEAD, security basics.
import { describe, expect, it, beforeEach } from "vitest";
import { Harness, call, jsonOf, cookieOf } from "../helpers/harness";

let h: Harness;
beforeEach(() => {
  h = new Harness();
  return () => h.close();
});

async function publish(content = "# Title\n\nBody text"): Promise<{ path: string; token: string; cookie: string }> {
  const res = await call(h, { method: "POST", path: "/publish", body: new URLSearchParams({ content, title: "T" }) });
  const loc = res.headers.get("location") || "";
  const path = new URL(loc, "http://graf.test").pathname.replace(/\//g, "");
  const token = cookieOf(res, "edit_token_" + path) || "";
  return { path, token, cookie: "edit_token_" + path + "=" + token };
}

describe("publish flow", () => {
  it("publish -> view -> edit -> view", async () => {
    const { path, cookie } = await publish("hello world");
    const view1 = await call(h, { path: "/" + path + "/", cookie });
    expect(view1.status).toBe(200);
    expect(await view1.text()).toContain("<p>hello world</p>");
    // edit via cookie
    const editGet = await call(h, { path: "/" + path + "/edit", cookie });
    expect(editGet.status).toBe(200);
    const save = await call(h, { method: "POST", path: "/" + path + "/edit", body: new URLSearchParams({ content: "updated text", title: "T2", author: "A" }), cookie });
    expect(save.status).toBe(303);
    const view2 = await call(h, { path: "/" + path + "/", cookie });
    expect(await view2.text()).toContain("updated text");
  });
  it("empty content on publish just redirects home", async () => {
    const res = await call(h, { method: "POST", path: "/publish", body: new URLSearchParams({ content: "   " }) });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
  });
  it("rejects oversized content with 400", async () => {
    const res = await call(h, { method: "POST", path: "/publish", body: new URLSearchParams({ content: "x".repeat(200_001) }) });
    expect(res.status).toBe(400);
  });
  it("GET /publish redirects home", async () => {
    const res = await call(h, { path: "/publish" });
    expect(res.status).toBe(303);
  });
});

describe("edit token semantics", () => {
  it("view with ?token= sets cookie and 303s to the clean canonical URL", async () => {
    const { path, token } = await publish();
    const res = await call(h, { path: "/" + path + "/?token=" + encodeURIComponent(token) });
    expect(res.status).toBe(303);
    const loc = new URL(res.headers.get("location") || "", "http://graf.test");
    expect(loc.pathname).toBe("/" + path + "/");
    expect(cookieOf(res, "edit_token_" + path)).toBe(token);
    // canonical view now carries editing rights
    const after = await call(h, { path: "/" + path + "/", cookie: "edit_token_" + path + "=" + token });
    expect(await after.text()).toContain("Edit");
  });
  it("GET /path/edit?token= persists the cookie so the form POST works", async () => {
    const { path, token } = await publish();
    const g = await call(h, { path: "/" + path + "/edit?token=" + token });
    expect(g.status).toBe(200);
    expect(cookieOf(g, "edit_token_" + path)).toBe(token);
    // no token in POST, only the cookie from GET
    const save = await call(h, {
      method: "POST",
      path: "/" + path + "/edit",
      body: new URLSearchParams({ content: "saved via cookie", title: "" }),
      cookie: "edit_token_" + path + "=" + token,
    });
    expect(save.status).toBe(303);
    const view = await call(h, { path: "/" + path + "/" });
    expect(await view.text()).toContain("saved via cookie");
  });
  it("edit without a token is 404", async () => {
    const { path } = await publish();
    const res = await call(h, { path: "/" + path + "/edit" });
    expect(res.status).toBe(404);
    const bad = await call(h, { path: "/" + path + "/edit?token=wrongtoken" });
    expect(bad.status).toBe(404);
  });
});

describe("views & HEAD", () => {
  it("views count browser GETs only", async () => {
    const { path } = await publish();
    const v = (p: string) => call(h, { method: "GET", path: "/getViews/" + p });
    expect(((await jsonOf(await v(path))).result as { views: number }).views).toBe(0);
    await call(h, { method: "HEAD", path: "/" + path + "/" });
    expect(((await jsonOf(await v(path))).result as { views: number }).views).toBe(0);
    await call(h, { path: "/" + path + "/" });
    expect(((await jsonOf(await v(path))).result as { views: number }).views).toBe(1);
  });
  it("HEAD returns headers but no body", async () => {
    const { path } = await publish();
    const res = await call(h, { method: "HEAD", path: "/" + path + "/" });
    expect(res.status).toBe(200);
    expect((await res.text()).length).toBe(0);
  });
  it("a second GET to a cached-unset page still returns fresh content after edit", async () => {
    const { path, cookie } = await publish("v1");
    const first = await call(h, { path: "/" + path + "/" });
    expect(await first.text()).toContain("v1");
    await call(h, { method: "POST", path: "/" + path + "/edit", body: new URLSearchParams({ content: "v2-edited" }), cookie });
    const second = await call(h, { path: "/" + path + "/" });
    const text2 = await second.text();
    expect(text2).toContain("v2-edited");
    expect(text2).not.toContain("v1");
  });
});

describe("security on web pages", () => {
  it("raw HTML in markdown is never rendered", async () => {
    const { path } = await publish("x <script>alert(1)</script> <img src=x onerror=alert(2)>");
    const res = await call(h, { path: "/" + path + "/" });
    const html = await res.text();
    // attacker payload must stay escaped text, never markup
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror=alert(2)>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(2)&gt;");
  });
  it("serves CSP + security headers on web responses", async () => {
    const { path } = await publish("hello");
    const res = await call(h, { path: "/" + path + "/" });
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });
  it("404 for unknown pages; HTML for web, JSON for unknown api", async () => {
    const web = await call(h, { path: "/NoSuchPage123/" });
    expect(web.status).toBe(404);
    expect((web.headers.get("content-type") || "").includes("text/html")).toBe(true);
    const api = await call(h, { path: "/api/v1/unknown" });
    expect(api.status).toBe(404);
    expect((api.headers.get("content-type") || "").includes("application/json")).toBe(true);
  });
});

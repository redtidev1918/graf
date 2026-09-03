// Downloads & author tools smoke (md download, book txt download).
import { describe, expect, it, beforeEach } from "vitest";
import { Harness, call, cookieOf } from "../helpers/harness";

let h: Harness;
beforeEach(() => {
  h = new Harness({ env: { BOOKS_ENABLED: "true" } });
  return () => h.close();
});

async function adminLogin(): Promise<string> {
  const res = await call(h, { method: "POST", path: "/admin/login", body: new URLSearchParams({ username: "admin", password: "s3cret" }) });
  return "graf_admin=" + (cookieOf(res, "graf_admin") as string);
}
async function publish(content: string, title: string): Promise<string> {
  const res = await call(h, { method: "POST", path: "/publish", body: new URLSearchParams({ content, title }) });
  const loc = res.headers.get("location") || "";
  return new URL(loc, "http://graf.test").pathname.replace(/\//g, "");
}

describe("downloads", () => {
  it("single page downloads its markdown with headers", async () => {
    const p = await publish("# 章节\n\n正文内容", "章节");
    const res = await call(h, { path: "/" + p + "/download" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") || "").toContain("text/markdown");
    expect(res.headers.get("content-disposition") || "").toContain('attachment; filename="graf-' + p + '.md"');
    const text = await res.text();
    expect(text).toContain("# 章节");
    expect(text).toContain("正文内容");
  });
  it("book txt concatenates chapters in order", async () => {
    const cookie = await adminLogin();
    await call(h, { method: "POST", path: "/admin/books", body: new URLSearchParams({ action: "create", title: "示例书", path: "b-demo" }), cookie });
    const p1 = await publish("第一章正文", "第一章");
    const p2 = await publish("第二章正文", "第二章");
    await call(h, { method: "POST", path: "/admin/books", body: new URLSearchParams({ action: "assign", book: "b-demo", pagePath: p1, order: "1" }), cookie });
    await call(h, { method: "POST", path: "/admin/books", body: new URLSearchParams({ action: "assign", book: "b-demo", pagePath: p2, order: "2" }), cookie });
    const res = await call(h, { path: "/book/b-demo/download" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") || "").toContain("text/plain");
    const txt = await res.text();
    expect(txt.indexOf("第 1 章 第一章")).toBeLessThan(txt.indexOf("第 2 章 第二章"));
    expect(txt).toContain("第一章正文");
    expect(txt).toContain("第二章正文");
    expect(txt).toContain("示例书");
  });
  it("download 404s for missing pages/books", async () => {
    expect((await call(h, { path: "/NoSuchPage1/download" })).status).toBe(404);
    expect((await call(h, { path: "/book/missing/download" })).status).toBe(404);
  });
  it("view pages expose the markdown download link", async () => {
    const p = await publish("hi", "H");
    const html = await (await call(h, { path: "/" + p + "/" })).text();
    expect(html).toContain("下载本文");
  });
});


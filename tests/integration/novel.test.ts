// Lightweight novel mode (book/chapter) — enabled via BOOKS_ENABLED.
import { describe, expect, it, beforeEach } from "vitest";
import { Harness, call, cookieOf } from "../helpers/harness";

let h: Harness;
beforeEach(() => {
  h = new Harness({ env: { BOOKS_ENABLED: "true" } });
  return () => h.close();
});

async function adminLogin(): Promise<string> {
  const res = await call(h, { method: "POST", path: "/admin/login", body: new URLSearchParams({ username: "admin", password: "s3cret" }) });
  const v = cookieOf(res, "graf_admin") as string;
  return "graf_admin=" + v;
}

async function publish(content: string): Promise<string> {
  const res = await call(h, { method: "POST", path: "/publish", body: new URLSearchParams({ content }) });
  const loc = res.headers.get("location") || "";
  return new URL(loc, "http://graf.test").pathname.replace(/\//g, "");
}

describe("novel mode", () => {
  it("books index + book catalog list chapters in order", async () => {
    const cookie = await adminLogin();
    await call(h, { method: "POST", path: "/admin/books", body: new URLSearchParams({ action: "create", title: "我的小说", path: "my-novel", author: "某作者", description: "简介" }), cookie });
    const p1 = await publish("第一章内容");
    const p2 = await publish("第二章内容");
    await call(h, { method: "POST", path: "/admin/books", body: new URLSearchParams({ action: "assign", book: "my-novel", pagePath: p1, order: "1" }), cookie });
    await call(h, { method: "POST", path: "/admin/books", body: new URLSearchParams({ action: "assign", book: "my-novel", pagePath: p2, order: "2" }), cookie });

    const index = await call(h, { path: "/books" });
    expect(index.status).toBe(200);
    const idxText = await index.text();
    expect(idxText).toContain("我的小说");
    expect(idxText).toContain("共 2 章");

    const cat = await call(h, { path: "/book/my-novel" });
    expect(cat.status).toBe(200);
    const catText = await cat.text();
    expect(catText.indexOf(p1)).toBeLessThan(catText.indexOf(p2));
    expect(catText).toContain("某作者");
  });

  it("chapter pages render prev/next navigation inside a book", async () => {
    const cookie = await adminLogin();
    await call(h, { method: "POST", path: "/admin/books", body: new URLSearchParams({ action: "create", title: "B", path: "b1" }), cookie });
    const p1 = await publish("一");
    const p2 = await publish("二");
    const p3 = await publish("三");
    for (const [p, o] of [[p1, 1], [p2, 2], [p3, 3]] as Array<[string, number]>) {
      await call(h, { method: "POST", path: "/admin/books", body: new URLSearchParams({ action: "assign", book: "b1", pagePath: p, order: String(o) }), cookie });
    }
    const v1 = await (await call(h, { path: "/" + p1 + "/" })).text();
    expect(v1).toContain("回目录");
    expect(v1).not.toContain("上一章");
    expect(v1).toContain("下一章");
    const v2 = await (await call(h, { path: "/" + p2 + "/" })).text();
    expect(v2).toContain("上一章");
    expect(v2).toContain("下一章");
    expect(v2).toContain("2 / 3");
    const v3 = await (await call(h, { path: "/" + p3 + "/" })).text();
    expect(v3).not.toContain("下一章");
  });

  it("unassigned pages and disabled mode have no book chrome", async () => {
    const cookie = await adminLogin();
    await call(h, { method: "POST", path: "/admin/books", body: new URLSearchParams({ action: "create", title: "B", path: "b2" }), cookie });
    const solo = await publish("游离章节");
    const t1 = await (await call(h, { path: "/" + solo + "/" })).text();
    expect(t1).not.toContain("回目录");

    const h2 = new Harness(); // BOOKS_ENABLED false
    try {
      const off = await call(h2, { path: "/books" });
      expect(off.status).toBe(404);
    } finally {
      h2.close();
    }
  });

  it("deleting a book unassigns chapters but keeps pages", async () => {
    const cookie = await adminLogin();
    await call(h, { method: "POST", path: "/admin/books", body: new URLSearchParams({ action: "create", title: "B", path: "b3" }), cookie });
    const p = await publish("内容");
    await call(h, { method: "POST", path: "/admin/books", body: new URLSearchParams({ action: "assign", book: "b3", pagePath: p }), cookie });
    await call(h, { method: "POST", path: "/admin/books", body: new URLSearchParams({ action: "delete", path: "b3" }), cookie });
    const page = await call(h, { path: "/" + p + "/" });
    expect(page.status).toBe(200);
    expect(await page.text()).not.toContain("回目录");
    const cat = await call(h, { path: "/book/b3" });
    expect(cat.status).toBe(404);
  });
});


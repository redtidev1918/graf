// Backup/restore is real disaster recovery: export -> import into a fresh DB -> export.
import { describe, expect, it, beforeEach } from "vitest";
import { Harness, call, jsonOf, cookieOf } from "../helpers/harness";

let h: Harness;
beforeEach(() => {
  h = new Harness();
  return () => h.close();
});

async function seed(hh: Harness): Promise<void> {
  await call(hh, { method: "POST", path: "/publish", body: new URLSearchParams({ content: "# Hello\n\nWorld **bold**", title: "Seeded", author: "A" }) });
  const acc = await call(hh, { method: "POST", path: "/createAccount", body: { short_name: "s" } });
  const token = ((await jsonOf(acc)).result as { access_token: string }).access_token;
  await call(hh, { method: "POST", path: "/createPage", body: { access_token: token, title: "Api", content: JSON.stringify([{ tag: "p", children: ["api body"] }]) } });
}

async function q<T = Record<string, unknown>>(sql: string, ...p: unknown[]): Promise<T[]> {
  const r = await h.db.prepare(sql).bind(...p).all<T>();
  return r.results;
}

async function adminCookie(hh: Harness): Promise<string> {
  const res = await call(hh, { method: "POST", path: "/admin/login", body: new URLSearchParams({ username: "admin", password: "s3cret" }) });
  const v = cookieOf(res, "graf_admin") as string;
  return "graf_admin=" + v;
}

async function exportAll(hh: Harness): Promise<Record<string, unknown>> {
  const res = await call(hh, { path: "/admin/export", cookie: await adminCookie(hh) });
  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, unknown>;
}

describe("backup round-trip", () => {
  it("export -> import into a fresh DB -> export preserves pages and comments", async () => {
    await seed(h);
    const pagesRows = await q<{ path: string }>("SELECT path FROM pages ORDER BY id ASC LIMIT 1");
    const work = pagesRows[0]!.path;
    await call(h, { method: "POST", path: "/api/v1/comments", body: { siteId: "default", workId: work, chapterId: "main", paraIndex: 0, content: "nice" } });

    const backup = await exportAll(h);
    const pages1 = backup.pages as Array<Record<string, unknown>>;
    const comments1 = backup.comments as Array<Record<string, unknown>>;
    expect(pages1.length).toBe(2);
    expect(comments1.length).toBe(1);
    expect(JSON.stringify(backup)).not.toMatch(/"ip"\s*:/);
    expect(JSON.stringify(backup)).not.toMatch(/access_token/);

    const h2 = new Harness();
    try {
      const cookie2 = await adminCookie(h2);
      const imp = await call(h2, { method: "POST", path: "/admin/import", body: JSON.stringify(backup), cookie: cookie2 });
      expect(imp.status).toBe(200);
      const backup2 = await exportAll(h2);
      const pages2 = backup2.pages as Array<Record<string, unknown>>;
      const comments2 = backup2.comments as Array<Record<string, unknown>>;
      expect(pages2.length).toBe(2);
      expect(comments2.length).toBe(1);
      const norm = (arr: Array<Record<string, unknown>>) =>
        arr.map((r) => JSON.stringify({ path: r.path, title: r.title, author: r.author, content: r.content, edit_token: r.edit_token })).sort();
      expect(norm(pages2)).toEqual(norm(pages1));
      expect(norm(comments2)).toEqual(norm(comments1 as Array<Record<string, unknown>>));
    } finally {
      h2.close();
    }
  });
  it("import restores a usable page with its view count", async () => {
    const h2 = new Harness();
    try {
      const backup = {
        format: "graf-backup",
        version: 1,
        pages: [{ path: "Restore12", title: "R", author: "", content: "restored body", link_target: "_self", edit_token: "et", views: 3, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }],
        comments: [],
      };
      const cookie = await adminCookie(h2);
      const imp = await call(h2, { method: "POST", path: "/admin/import", body: JSON.stringify(backup), cookie });
      expect(imp.status).toBe(200);
      const api = await call(h2, { method: "POST", path: "/getViews", body: { path: "Restore12" } });
      expect(((await jsonOf(api)).result as { views: number }).views).toBe(3);
      const view = await call(h2, { path: "/Restore12/" });
      expect(view.status).toBe(200);
      expect(await view.text()).toContain("restored body");
    } finally {
      h2.close();
    }
  });
});

// ParaNote-compatible comment API contract tests (real SQLite via route layer).
import { describe, expect, it, beforeEach } from "vitest";
import { Harness, call, jsonOf, cookieOf } from "../helpers/harness";

let h: Harness;
beforeEach(() => {
  h = new Harness();
  return () => h.close();
});

async function publishPage(): Promise<{ path: string; cookie: string }> {
  const res = await call(h, { method: "POST", path: "/publish", body: new URLSearchParams({ content: "Hello **world**" }) });
  const path = new URL(res.headers.get("location") || "", "http://graf.test").pathname.replace(/\//g, "");
  const cookie = "edit_token_" + path + "=" + (cookieOf(res, "edit_token_" + path) || "");
  return { path, cookie };
}

async function postComment(workId: string, content = "Nice post"): Promise<number> {
  const res = await call(h, {
    method: "POST",
    path: "/api/v1/comments",
    body: { siteId: "default", workId, chapterId: "main", paraIndex: 0, content },
  });
  expect(res.status).toBe(201);
  return ((await jsonOf(res)) as { id: number }).id;
}

async function q<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
  const r = await h.db.prepare(sql).bind(...params).all<T>();
  return r.results;
}

describe("comments disabled", () => {
  it("returns 403 everywhere when ENABLE_COMMENTS=false", async () => {
    h = new Harness({ env: { ENABLE_COMMENTS: "false" } });
    const get = await call(h, { path: "/api/v1/comments?siteId=s&workId=w&chapterId=c" });
    expect(get.status).toBe(403);
    const post = await call(h, { method: "POST", path: "/api/v1/comments", body: {} });
    expect(post.status).toBe(403);
    const like = await call(h, { method: "POST", path: "/api/v1/comments/like", body: {} });
    expect(like.status).toBe(403);
  });
});

describe("comments CRUD", () => {
  it("creates, lists grouped by para, and preserves guest identity", async () => {
    const { path } = await publishPage();
    const id = await postComment(path);
    const list = await call(h, { path: "/api/v1/comments?siteId=default&workId=" + path + "&chapterId=main" });
    const data = await jsonOf(list);
    const byPara = data.commentsByPara as Record<string, Array<Record<string, unknown>>>;
    expect(byPara["0"]!.length).toBe(1);
    const c0 = byPara["0"]![0]!;
    expect(c0.id).toBe(id);
    expect(c0.userName).toMatch(/^Guest-/);
    expect(c0.isLiked).toBe(false);
    // stable identity: same ip+site => same user_id across a second comment
    await postComment(path, "second");
    const list2 = await call(h, { path: "/api/v1/comments?siteId=default&workId=" + path + "&chapterId=main" });
    const j2 = await jsonOf(list2);
    const arr = (j2.commentsByPara as Record<string, Array<{ userId: string | null }>>)["0"]!;
    expect(arr[0]!.userId).toBe(arr[1]!.userId);
  });
  it("rejects missing / bad input", async () => {
    const { path } = await publishPage();
    const badSite = await call(h, { method: "POST", path: "/api/v1/comments", body: { siteId: "../x", workId: path, chapterId: "main", paraIndex: 0, content: "x" } });
    expect(badSite.status).toBe(400);
    const noContent = await call(h, { method: "POST", path: "/api/v1/comments", body: { siteId: "default", workId: path, chapterId: "main", paraIndex: 0, content: "   " } });
    expect(noContent.status).toBe(400);
    const neg = await call(h, { method: "POST", path: "/api/v1/comments", body: { siteId: "default", workId: path, chapterId: "main", paraIndex: -5, content: "x" } });
    expect(neg.status).toBe(400);
    const long = await call(h, { method: "POST", path: "/api/v1/comments", body: { siteId: "default", workId: path, chapterId: "main", paraIndex: 0, content: "x".repeat(20_000) } });
    expect(long.status).toBe(400);
  });
  it("duplicate like is rejected and counter stays consistent with like_records", async () => {
    const { path } = await publishPage();
    const id = await postComment(path);
    const like = (body: Record<string, unknown>) => call(h, { method: "POST", path: "/api/v1/comments/like", body });
    const r1 = await like({ siteId: "default", workId: path, chapterId: "main", commentId: id });
    expect(((await jsonOf(r1)) as { likes: number }).likes).toBe(1);
    const r2 = await like({ siteId: "default", workId: path, chapterId: "main", commentId: id });
    expect(r2.status).toBe(400);
    const rec = await q<{ n: number }>("SELECT COUNT(*) AS n FROM like_records WHERE comment_id = ?", id);
    const row = await q<{ likes: number }>("SELECT likes FROM comments WHERE id = ?", id);
    expect(rec[0]!.n).toBe(1);
    expect(row[0]!.likes).toBe(1);
  });
  it("author can delete; other visitors cannot", async () => {
    const { path, cookie } = await publishPage();
    const id = await postComment(path);
    const stranger = await call(h, {
      method: "DELETE",
      path: "/api/v1/comments",
      body: { siteId: "default", workId: path, chapterId: "main", commentId: id },
      headers: { "sec-fetch-site": "same-origin" },
    });
    expect(stranger.status).toBe(403);
    const author = await call(h, {
      method: "DELETE",
      path: "/api/v1/comments",
      body: { siteId: "default", workId: path, chapterId: "main", commentId: id },
      cookie,
      headers: { "sec-fetch-site": "same-origin" },
    });
    expect(author.status).toBe(200);
    const row = await q<{ n: number }>("SELECT COUNT(*) AS n FROM comments WHERE id = ?", id);
    expect(row[0]!.n).toBe(0);
  });
  it("deleting a comment removes its likes", async () => {
    const { path, cookie } = await publishPage();
    const id = await postComment(path);
    await call(h, { method: "POST", path: "/api/v1/comments/like", body: { siteId: "default", commentId: id } });
    await call(h, { method: "DELETE", path: "/api/v1/comments", body: { siteId: "default", workId: path, chapterId: "main", commentId: id }, cookie });
    const rec = await q<{ n: number }>("SELECT COUNT(*) AS n FROM like_records");
    expect(rec[0]!.n).toBe(0);
  });
  it("guest identity differs across sites (HMAC isolation)", async () => {
    const { path } = await publishPage();
    const a = await call(h, { method: "POST", path: "/api/v1/comments", body: { siteId: "siteA", workId: path, chapterId: "main", paraIndex: 0, content: "a" } });
    const b = await call(h, { method: "POST", path: "/api/v1/comments", body: { siteId: "siteB", workId: path, chapterId: "main", paraIndex: 0, content: "b" } });
    const uidA = ((await jsonOf(a)) as { userId: string | null }).userId;
    const uidB = ((await jsonOf(b)) as { userId: string | null }).userId;
    expect(uidA).not.toBe(uidB);
    expect(uidA).toMatch(/^ip_[0-9a-f]+$/);
  });
});

describe("bans (admin via session)", () => {
  async function adminLogin(): Promise<string> {
    const res = await call(h, { method: "POST", path: "/admin/login", body: new URLSearchParams({ username: "admin", password: "s3cret" }) });
    const v = cookieOf(res, "graf_admin");
    expect(v).toBeTruthy();
    return "graf_admin=" + v;
  }
  it("banned guest cannot comment; unban restores", async () => {
    const { path } = await publishPage();
    const first = await call(h, { method: "POST", path: "/api/v1/comments", body: { siteId: "default", workId: path, chapterId: "main", paraIndex: 0, content: "first" } });
    const uid = ((await jsonOf(first)) as { userId: string | null }).userId;
    const cookie = await adminLogin();
    const ban = await call(h, { method: "POST", path: "/api/v1/ban", body: { siteId: "default", targetUserId: uid, reason: "spam" }, cookie });
    expect(ban.status).toBe(200);
    const blocked = await call(h, { method: "POST", path: "/api/v1/comments", body: { siteId: "default", workId: path, chapterId: "main", paraIndex: 0, content: "spam" } });
    expect(blocked.status).toBe(403);
    expect((await jsonOf(blocked)).error).toBe("user_banned");
    const unban = await call(h, { method: "DELETE", path: "/api/v1/ban", body: { siteId: "default", targetUserId: uid }, cookie });
    expect(unban.status).toBe(200);
    const ok2 = await call(h, { method: "POST", path: "/api/v1/comments", body: { siteId: "default", workId: path, chapterId: "main", paraIndex: 0, content: "back" } });
    expect(ok2.status).toBe(201);
  });
  it("rejects foreign-origin ban mutations (CSRF)", async () => {
    const cookie = await adminLogin();
    const res = await call(h, {
      method: "POST",
      path: "/api/v1/ban",
      body: { siteId: "default", targetUserId: "x" },
      cookie,
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    });
    expect(res.status).toBe(403);
    expect((await jsonOf(res)).error).toBe("origin_mismatch");
  });
  it("non-admin cannot ban", async () => {
    const res = await call(h, { method: "POST", path: "/api/v1/ban", body: { siteId: "default", targetUserId: "x" } });
    expect(res.status).toBe(403);
  });
});
// D1 data access. All SQL lives here.
export interface AccountRow {
  id: number;
  short_name: string;
  author_name: string;
  author_url: string;
  access_token: string;
  created_at: string;
}

export interface PageRow {
  id: number;
  path: string;
  title: string;
  author: string;
  content: string;
  link_target: string;
  edit_token: string;
  account_id: number | null;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface CommentRow {
  id: number;
  site_id: string;
  work_id: string;
  chapter_id: string;
  para_index: number;
  content: string;
  user_name: string;
  user_id: string | null;
  user_avatar: string | null;
  context_text: string | null;
  ip: string | null;
  likes: number;
  created_at: string;
}

export interface BanRow {
  id: number;
  site_id: string;
  user_id: string;
  reason: string | null;
  banned_by: string | null;
  created_at: string;
}

type SqlValue = string | number | null;

async function run(db: D1Database, sql: string, ...params: SqlValue[]): Promise<D1Result> {
  return db.prepare(sql).bind(...params).run();
}

async function all<T = Record<string, unknown>>(db: D1Database, sql: string, ...params: SqlValue[]): Promise<T[]> {
  const res = await db.prepare(sql).bind(...params).all<T>();
  return (res.results ?? []) as T[];
}

async function first<T = Record<string, unknown>>(db: D1Database, sql: string, ...params: SqlValue[]): Promise<T | null> {
  const rows = await all<T>(db, sql, ...params);
  return rows[0] ?? null;
}

export interface SqlBatchItem {
  sql: string;
  params: SqlValue[];
}

/** Atomic batch if the binding supports it (D1/SqliteD1), else sequential fallback. */
export async function batchExec(db: D1Database, items: SqlBatchItem[]): Promise<void> {
  const candidate = db as unknown as { batch?: (i: SqlBatchItem[]) => Promise<unknown[]> };
  if (typeof candidate.batch === "function") {
    // Call as a method so the adapter instance keeps its bindings.
    await candidate.batch(items);
    return;
  }
  for (const it of items) {
    await run(db, it.sql, ...it.params);
  }
}

// ---------- accounts ----------

export async function accountByToken(db: D1Database, token: string): Promise<AccountRow | null> {
  return first<AccountRow>(
    db,
    "SELECT id, short_name, author_name, author_url, access_token, created_at FROM accounts WHERE access_token = ?",
    token,
  );
}

export async function accountById(db: D1Database, id: number): Promise<AccountRow | null> {
  return first<AccountRow>(
    db,
    "SELECT id, short_name, author_name, author_url, access_token, created_at FROM accounts WHERE id = ?",
    id,
  );
}

export async function createAccount(
  db: D1Database,
  a: { short_name: string; author_name: string; author_url: string; access_token: string; created_at: string },
): Promise<AccountRow> {
  const res = await run(
    db,
    "INSERT INTO accounts (short_name, author_name, author_url, access_token, created_at) VALUES (?, ?, ?, ?, ?)",
    a.short_name, a.author_name, a.author_url, a.access_token, a.created_at,
  );
  return (await accountById(db, Number(res.meta.last_row_id)))!;
}

export async function rotateAccountToken(db: D1Database, id: number, token: string): Promise<void> {
  await run(db, "UPDATE accounts SET access_token = ? WHERE id = ?", token, id);
}

export async function countAccounts(db: D1Database): Promise<number> {
  const row = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM accounts");
  return row?.n ?? 0;
}

// ---------- pages ----------

export async function pageByPath(db: D1Database, path: string): Promise<PageRow | null> {
  return first<PageRow>(
    db,
    "SELECT id, path, title, author, content, link_target, edit_token, account_id, views, created_at, updated_at FROM pages WHERE path = ?",
    path,
  );
}

export async function pageById(db: D1Database, id: number): Promise<PageRow | null> {
  return first<PageRow>(
    db,
    "SELECT id, path, title, author, content, link_target, edit_token, account_id, views, created_at, updated_at FROM pages WHERE id = ?",
    id,
  );
}

export interface NewPage {
  path: string;
  title: string;
  author: string;
  content: string;
  link_target: string;
  edit_token: string;
  account_id: number | null;
  created_at: string;
}

export async function createPage(db: D1Database, p: NewPage): Promise<PageRow> {
  const res = await run(
    db,
    "INSERT INTO pages (path, title, author, content, link_target, edit_token, account_id, views, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
    p.path, p.title, p.author, p.content, p.link_target, p.edit_token, p.account_id, p.created_at, p.created_at,
  );
  return (await pageById(db, Number(res.meta.last_row_id)))!;
}

export async function updatePageContent(
  db: D1Database,
  id: number,
  fields: { title: string; author: string; content: string; link_target: string; updated_at: string },
): Promise<void> {
  await run(
    db,
    "UPDATE pages SET title = ?, author = ?, content = ?, link_target = ?, updated_at = ? WHERE id = ?",
    fields.title, fields.author, fields.content, fields.link_target, fields.updated_at, id,
  );
}

export async function incrementViews(db: D1Database, id: number): Promise<void> {
  await run(db, "UPDATE pages SET views = views + 1 WHERE id = ?", id);
}

export async function pagesByAccount(
  db: D1Database,
  accountId: number,
  offset: number,
  limit: number,
): Promise<{ pages: PageRow[]; total: number }> {
  const totalRow = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM pages WHERE account_id = ?", accountId);
  const pages = await all<PageRow>(
    db,
    "SELECT id, path, title, author, content, link_target, edit_token, account_id, views, created_at, updated_at FROM pages WHERE account_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
    accountId, limit, offset,
  );
  return { pages, total: totalRow?.n ?? 0 };
}

export async function recentPages(db: D1Database, limit = 30, offset = 0): Promise<PageRow[]> {
  return all<PageRow>(
    db,
    "SELECT id, path, title, author, content, link_target, edit_token, account_id, views, created_at, updated_at FROM pages ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
    limit, offset,
  );
}

export async function searchPages(db: D1Database, q: string, limit = 200, offset = 0): Promise<PageRow[]> {
  const like = "%" + q + "%";
  return all<PageRow>(
    db,
    "SELECT id, path, title, author, content, link_target, edit_token, account_id, views, created_at, updated_at FROM pages WHERE path LIKE ? OR title LIKE ? OR author LIKE ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
    like, like, like, limit, offset,
  );
}

export async function deletePage(db: D1Database, id: number): Promise<void> {
  // Order matters: collect the page path while the page still exists, then remove
  // like_records -> comments -> page atomically (no orphan comments/likes left behind).
  await batchExec(db, [
    {
      sql: "DELETE FROM like_records WHERE comment_id IN (SELECT id FROM comments WHERE work_id = (SELECT path FROM pages WHERE id = ?))",
      params: [id],
    },
    { sql: "DELETE FROM comments WHERE work_id = (SELECT path FROM pages WHERE id = ?)", params: [id] },
    { sql: "DELETE FROM pages WHERE id = ?", params: [id] },
  ]);
}

export async function countPages(db: D1Database): Promise<number> {
  const row = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM pages");
  return row?.n ?? 0;
}

export interface BackupPage {
  path: string;
  title: string;
  author: string;
  content: string;
  link_target: string;
  edit_token: string;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface BackupComment {
  site_id: string;
  work_id: string;
  chapter_id: string;
  para_index: number;
  content: string;
  user_name: string;
  user_id: string | null;
  user_avatar: string | null;
  context_text: string | null;
  likes: number;
  created_at: string;
}

/**
 * Idempotent, atomic backup import. Pages upsert by path; comments use
 * INSERT OR IGNORE relying on the dedupe index (0002). Either everything
 * is written (batch transaction) or nothing is.
 */
export async function importBackup(db: D1Database, pages: BackupPage[], comments: BackupComment[]): Promise<{ pages: number; comments: number }> {
  const items: SqlBatchItem[] = [];
  for (const p of pages) {
    items.push({
      sql:
        "INSERT INTO pages (path, title, author, content, link_target, edit_token, views, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(path) DO UPDATE SET title = excluded.title, author = excluded.author, content = excluded.content, " +
        "link_target = excluded.link_target, edit_token = excluded.edit_token, views = excluded.views, updated_at = excluded.updated_at",
      params: [p.path, p.title, p.author, p.content, p.link_target, p.edit_token, p.views, p.created_at, p.updated_at],
    });
  }
  for (const cm of comments) {
    items.push({
      sql:
        "INSERT OR IGNORE INTO comments (site_id, work_id, chapter_id, para_index, content, user_name, user_id, user_avatar, context_text, ip, likes, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
      params: [cm.site_id, cm.work_id, cm.chapter_id, cm.para_index, cm.content, cm.user_name, cm.user_id, cm.user_avatar, cm.context_text, cm.likes, cm.created_at],
    });
  }
  const beforeComments = (await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM comments"))?.n ?? 0;
  const beforePages = (await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM pages"))?.n ?? 0;
  await batchExec(db, items);
  const afterComments = (await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM comments"))?.n ?? 0;
  const afterPages = (await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM pages"))?.n ?? 0;
  return { pages: Math.max(0, afterPages - beforePages), comments: Math.max(0, afterComments - beforeComments) };
}

export async function allPagesForExport(db: D1Database): Promise<PageRow[]> {
  return all<PageRow>(db, "SELECT id, path, title, author, content, link_target, edit_token, account_id, views, created_at, updated_at FROM pages ORDER BY id ASC");
}

// ---------- comments ----------

export async function commentsByWork(db: D1Database, siteId: string, workId: string, chapterId: string): Promise<CommentRow[]> {
  return all<CommentRow>(
    db,
    "SELECT id, site_id, work_id, chapter_id, para_index, content, user_name, user_id, user_avatar, context_text, ip, likes, created_at FROM comments WHERE site_id = ? AND work_id = ? AND chapter_id = ? ORDER BY created_at ASC, id ASC",
    siteId, workId, chapterId,
  );
}

export async function commentById(db: D1Database, id: number): Promise<CommentRow | null> {
  return first<CommentRow>(
    db,
    "SELECT id, site_id, work_id, chapter_id, para_index, content, user_name, user_id, user_avatar, context_text, ip, likes, created_at FROM comments WHERE id = ?",
    id,
  );
}

export interface NewComment {
  site_id: string;
  work_id: string;
  chapter_id: string;
  para_index: number;
  content: string;
  user_name: string;
  user_id: string | null;
  user_avatar: string | null;
  context_text: string | null;
  ip: string | null;
  created_at: string;
}

export async function createComment(db: D1Database, c: NewComment): Promise<CommentRow> {
  const res = await run(
    db,
    "INSERT INTO comments (site_id, work_id, chapter_id, para_index, content, user_name, user_id, user_avatar, context_text, ip, likes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)",
    c.site_id, c.work_id, c.chapter_id, c.para_index, c.content, c.user_name, c.user_id, c.user_avatar, c.context_text, c.ip, c.created_at,
  );
  return (await commentById(db, Number(res.meta.last_row_id)))!;
}

export async function deleteComment(db: D1Database, id: number): Promise<void> {
  await batchExec(db, [
    { sql: "DELETE FROM like_records WHERE comment_id = ?", params: [id] },
    { sql: "DELETE FROM comments WHERE id = ?", params: [id] },
  ]);
}

export async function countCommentsByIpSince(db: D1Database, ip: string, sinceIso: string): Promise<number> {
  const row = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM comments WHERE ip = ? AND created_at >= ?", ip, sinceIso);
  return row?.n ?? 0;
}

export async function recentComments(db: D1Database, siteId: string | null, limit = 50, offset = 0): Promise<CommentRow[]> {
  if (siteId) {
    return all<CommentRow>(
      db,
      "SELECT id, site_id, work_id, chapter_id, para_index, content, user_name, user_id, user_avatar, context_text, ip, likes, created_at FROM comments WHERE site_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
      siteId, limit, offset,
    );
  }
  return all<CommentRow>(
    db,
    "SELECT id, site_id, work_id, chapter_id, para_index, content, user_name, user_id, user_avatar, context_text, ip, likes, created_at FROM comments ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
    limit, offset,
  );
}

export async function countComments(db: D1Database): Promise<number> {
  const row = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM comments");
  return row?.n ?? 0;
}

export async function allCommentsForExport(db: D1Database): Promise<CommentRow[]> {
  return all<CommentRow>(db, "SELECT id, site_id, work_id, chapter_id, para_index, content, user_name, user_id, user_avatar, context_text, ip, likes, created_at FROM comments ORDER BY id ASC");
}

// ---------- likes ----------

export async function addLike(db: D1Database, commentId: number, userId: string, ip: string | null, createdAt: string): Promise<"added" | "exists"> {
  try {
    await run(db, "INSERT INTO like_records (comment_id, user_id, ip, created_at) VALUES (?, ?, ?, ?)", commentId, userId, ip, createdAt);
    return "added";
  } catch {
    return "exists";
  }
}

export async function recountLikes(db: D1Database, commentId: number): Promise<number> {
  const row = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM like_records WHERE comment_id = ?", commentId);
  const n = row?.n ?? 0;
  await run(db, "UPDATE comments SET likes = ? WHERE id = ?", n, commentId);
  return n;
}

export async function likedCommentIdsByUser(db: D1Database, userId: string, commentIds: number[]): Promise<Set<number>> {
  if (commentIds.length === 0) return new Set();
  const marks = commentIds.map(() => "?").join(",");
  const rows = await all<{ comment_id: number }>(
    db,
    "SELECT comment_id FROM like_records WHERE user_id = ? AND comment_id IN (" + marks + ")",
    userId, ...commentIds,
  );
  return new Set(rows.map((r) => r.comment_id));
}

export async function countLikesByIpSince(db: D1Database, ip: string, sinceIso: string): Promise<number> {
  const row = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM like_records WHERE ip = ? AND created_at >= ?", ip, sinceIso);
  return row?.n ?? 0;
}

// ---------- bans ----------

export async function bansBySite(db: D1Database, siteId: string): Promise<BanRow[]> {
  return all<BanRow>(db, "SELECT id, site_id, user_id, reason, banned_by, created_at FROM bans WHERE site_id = ? ORDER BY created_at DESC", siteId);
}

export async function isBanned(db: D1Database, siteId: string, userId: string): Promise<boolean> {
  const row = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM bans WHERE site_id = ? AND user_id = ?", siteId, userId);
  return (row?.n ?? 0) > 0;
}

export async function addBan(
  db: D1Database,
  siteId: string,
  userId: string,
  reason: string | null,
  bannedBy: string,
  createdAt: string,
): Promise<void> {
  await run(
    db,
    "INSERT INTO bans (site_id, user_id, reason, banned_by, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(site_id, user_id) DO UPDATE SET reason = excluded.reason, banned_by = excluded.banned_by",
    siteId, userId, reason, bannedBy, createdAt,
  );
}

export async function removeBan(db: D1Database, siteId: string, userId: string): Promise<boolean> {
  const res = await run(db, "DELETE FROM bans WHERE site_id = ? AND user_id = ?", siteId, userId);
  return (res.meta.changes ?? 0) > 0;
}
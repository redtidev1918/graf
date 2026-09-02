-- Graf 初始 schema (Cloudflare D1)
-- 应用: wrangler d1 migrations apply graf

CREATE TABLE IF NOT EXISTS accounts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  short_name    TEXT NOT NULL,
  author_name   TEXT NOT NULL DEFAULT 'Anonymous',
  author_url    TEXT NOT NULL DEFAULT '',
  access_token  TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_token ON accounts(access_token);

CREATE TABLE IF NOT EXISTS pages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  path         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL DEFAULT '',
  author       TEXT NOT NULL DEFAULT '',
  content      TEXT NOT NULL,
  link_target  TEXT NOT NULL DEFAULT '_self',
  edit_token   TEXT NOT NULL,
  account_id   INTEGER,
  views        INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pages_path ON pages(path);
CREATE INDEX IF NOT EXISTS idx_pages_account ON pages(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id       TEXT NOT NULL,
  work_id       TEXT NOT NULL,
  chapter_id    TEXT NOT NULL,
  para_index    INTEGER NOT NULL,
  content       TEXT NOT NULL,
  user_name     TEXT NOT NULL DEFAULT 'Anonymous',
  user_id       TEXT,
  user_avatar   TEXT,
  context_text  TEXT,
  ip            TEXT,
  likes         INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_locator
  ON comments(site_id, work_id, chapter_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_ip_time ON comments(ip, created_at);

CREATE TABLE IF NOT EXISTS like_records (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id   INTEGER NOT NULL,
  user_id      TEXT,
  ip           TEXT,
  created_at   TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_uid
  ON like_records(comment_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_ip
  ON like_records(comment_id, ip) WHERE ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_likes_ip_time ON like_records(ip, created_at);
CREATE INDEX IF NOT EXISTS idx_likes_comment ON like_records(comment_id);

CREATE TABLE IF NOT EXISTS bans (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id      TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  reason       TEXT,
  banned_by    TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE(site_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bans_site ON bans(site_id);

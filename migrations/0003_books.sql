-- Graf 0003: 小说模式（book/chapter）
CREATE TABLE IF NOT EXISTS books (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  path        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
ALTER TABLE pages ADD COLUMN book_id INTEGER;
ALTER TABLE pages ADD COLUMN order_num INTEGER;
CREATE INDEX IF NOT EXISTS idx_pages_book ON pages(book_id, order_num, id);

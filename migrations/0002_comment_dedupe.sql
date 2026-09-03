-- Graf 0002: 评论去重索引（幂等导入 & 防止完全相同评论重复入库）
-- 唯一键: (site_id, work_id, chapter_id, para_index, user_id, content)
CREATE UNIQUE INDEX IF NOT EXISTS idx_comments_dedupe
  ON comments(site_id, work_id, chapter_id, para_index, user_id, content);

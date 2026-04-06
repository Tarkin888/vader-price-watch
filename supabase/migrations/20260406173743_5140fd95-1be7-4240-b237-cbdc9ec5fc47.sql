-- Remove public read access from operational log tables
DROP POLICY IF EXISTS "scraper_logs_read_public" ON scraper_logs;
DROP POLICY IF EXISTS "audit_log_read_public" ON audit_log;

-- Also fix the knowledge_articles overly permissive ALL policy for public role
DROP POLICY IF EXISTS "Service role can manage all articles" ON knowledge_articles;
CREATE POLICY "knowledge_articles_write_service_role" ON knowledge_articles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
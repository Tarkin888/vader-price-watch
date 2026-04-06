
-- ==========================================
-- LOTS: restrict writes to service_role
-- ==========================================
DROP POLICY IF EXISTS "Allow public insert" ON public.lots;
DROP POLICY IF EXISTS "Allow public update" ON public.lots;
DROP POLICY IF EXISTS "Allow public delete" ON public.lots;

CREATE POLICY "lots_write_service_role"
  ON public.lots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==========================================
-- COLLECTION: restrict writes to service_role
-- ==========================================
DROP POLICY IF EXISTS "Allow public insert" ON public.collection;
DROP POLICY IF EXISTS "Allow public update" ON public.collection;
DROP POLICY IF EXISTS "Allow public delete" ON public.collection;

CREATE POLICY "collection_write_service_role"
  ON public.collection FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==========================================
-- AUDIT_LOG: restrict writes to service_role
-- ==========================================
DROP POLICY IF EXISTS "Allow all access to audit_log" ON public.audit_log;

CREATE POLICY "audit_log_read_public"
  ON public.audit_log FOR SELECT TO public
  USING (true);

CREATE POLICY "audit_log_write_service_role"
  ON public.audit_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==========================================
-- SCRAPER_LOGS: restrict writes to service_role
-- ==========================================
DROP POLICY IF EXISTS "Allow all access to scraper_logs" ON public.scraper_logs;

CREATE POLICY "scraper_logs_read_public"
  ON public.scraper_logs FOR SELECT TO public
  USING (true);

CREATE POLICY "scraper_logs_write_service_role"
  ON public.scraper_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==========================================
-- BUG_REPORTS: restrict writes to service_role
-- ==========================================
DROP POLICY IF EXISTS "Allow all access to bug_reports" ON public.bug_reports;

CREATE POLICY "bug_reports_read_public"
  ON public.bug_reports FOR SELECT TO public
  USING (true);

CREATE POLICY "bug_reports_write_service_role"
  ON public.bug_reports FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==========================================
-- PAGE_VIEWS: keep INSERT public, restrict update/delete
-- ==========================================
DROP POLICY IF EXISTS "Allow all access to page_views" ON public.page_views;

CREATE POLICY "page_views_read_public"
  ON public.page_views FOR SELECT TO public
  USING (true);

CREATE POLICY "page_views_insert_public"
  ON public.page_views FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "page_views_write_service_role"
  ON public.page_views FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==========================================
-- KNOWLEDGE_ARTICLES: keep existing select policies, add service_role write
-- (the "Service role can manage all articles" policy already exists for service_role)
-- Just need to remove public write access if any extra permissive policies exist
-- ==========================================
-- The existing policies are fine: public SELECT on published, service_role ALL
-- No changes needed for knowledge_articles

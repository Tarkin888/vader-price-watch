-- Remove overly permissive anon policies on lots table
DROP POLICY IF EXISTS "anon_insert_lots" ON public.lots;
DROP POLICY IF EXISTS "anon_update_lots" ON public.lots;

-- Remove anon insert policy on scraper_logs (scrapers now use service_role)
DROP POLICY IF EXISTS "anon_insert_scraper_logs" ON public.scraper_logs;

-- Add admin read policy for audit_log so admins can view audit records
CREATE POLICY "audit_log_read_admin"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));
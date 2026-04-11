-- 1. Add admin read policy for scraper_logs
CREATE POLICY "scraper_logs_read_admin"
ON public.scraper_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- 2. Fix gallery storage: restrict SELECT to user's own folder
DROP POLICY IF EXISTS "Approved users can view gallery" ON storage.objects;
CREATE POLICY "Approved users can view own gallery files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'gallery'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);
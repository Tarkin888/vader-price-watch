
-- =============================================
-- 1. Fix privilege escalation on user_profiles INSERT
--    Constrain so new rows must match auth.uid(), role='user', status='pending'
-- =============================================
DROP POLICY IF EXISTS "Allow insert for new users" ON public.user_profiles;

CREATE POLICY "Allow insert for new users" ON public.user_profiles
  FOR INSERT TO public
  WITH CHECK (
    auth.uid() = id
    AND role = 'user'
    AND status = 'pending'
  );

-- =============================================
-- 2. Fix gallery storage: restrict uploads to authenticated users only
--    (policy already checks approved status via user_profiles)
-- =============================================
DROP POLICY IF EXISTS "Approved users can upload to gallery" ON storage.objects;

CREATE POLICY "Approved users can upload to gallery" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gallery'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.status = 'approved'
    )
  );

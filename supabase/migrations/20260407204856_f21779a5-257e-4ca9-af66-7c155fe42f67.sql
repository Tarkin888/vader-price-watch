
-- =============================================
-- 1. Fix collection UPDATE policy: add WITH CHECK to prevent user_id reassignment
-- =============================================
DROP POLICY IF EXISTS "Users can update own collection" ON public.collection;

CREATE POLICY "Users can update own collection" ON public.collection
  FOR UPDATE TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 2. Add explicit UPDATE policy for gallery storage (service_role only)
-- =============================================
CREATE POLICY "Gallery update service role only" ON storage.objects
  FOR UPDATE TO service_role
  USING (bucket_id = 'gallery')
  WITH CHECK (bucket_id = 'gallery');

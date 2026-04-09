-- Fix 1: Make gallery bucket private
UPDATE storage.buckets SET public = false WHERE id = 'gallery';

-- Drop any public SELECT policy on gallery objects
DROP POLICY IF EXISTS "Gallery public read" ON storage.objects;
DROP POLICY IF EXISTS "Public can view gallery" ON storage.objects;

-- Add SELECT policy for authenticated approved users
CREATE POLICY "Approved users can view gallery"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'gallery'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

-- Fix 2: Restrict admin_config SELECT to authenticated approved users
DROP POLICY IF EXISTS "Public read non-sensitive config" ON public.admin_config;
CREATE POLICY "Approved users read non-sensitive config"
ON public.admin_config
FOR SELECT
TO authenticated
USING (
  key <> 'admin_pin'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);
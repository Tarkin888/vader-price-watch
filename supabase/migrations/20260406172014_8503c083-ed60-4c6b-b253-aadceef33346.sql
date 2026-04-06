
-- 1. Fix admin_config: drop overly permissive policy
DROP POLICY IF EXISTS "Allow all access to admin_config" ON public.admin_config;

-- Public can read non-sensitive config (exclude admin_pin)
CREATE POLICY "Public read non-sensitive config"
  ON public.admin_config FOR SELECT TO public
  USING (key != 'admin_pin');

-- Service role has full access
CREATE POLICY "Service role full access"
  ON public.admin_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. Create secure PIN verification function
CREATE OR REPLACE FUNCTION public.verify_admin_pin(pin_input text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_config
    WHERE key = 'admin_pin' AND value = pin_input
  );
$$;

-- 3. Fix gallery storage: drop public delete policy
DROP POLICY IF EXISTS "Gallery public delete" ON storage.objects;

-- Only service_role can delete gallery files
CREATE POLICY "Gallery delete service role only"
  ON storage.objects FOR DELETE TO service_role
  USING (bucket_id = 'gallery');

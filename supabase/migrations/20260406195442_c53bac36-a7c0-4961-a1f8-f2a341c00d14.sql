CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = check_user_id
      AND role = 'admin'
      AND status = 'approved'
  );
$$;

DROP POLICY IF EXISTS "Admin can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;

CREATE POLICY "Admin can read all profiles"
ON public.user_profiles
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update all profiles"
ON public.user_profiles
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can read own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.repair_owner_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET role = 'admin', status = 'approved', approved_at = COALESCE(approved_at, now())
  WHERE id = auth.uid() AND LOWER(email) = 'zrezvi@gmail.com';
END;
$$;

UPDATE public.user_profiles
SET role = 'admin', status = 'approved', approved_at = COALESCE(approved_at, now())
WHERE LOWER(email) = 'zrezvi@gmail.com';
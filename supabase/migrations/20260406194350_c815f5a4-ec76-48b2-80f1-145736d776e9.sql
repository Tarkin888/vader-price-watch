
-- Fix handle_new_user with case-insensitive check and upsert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, avatar_url, role, status, approved_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', null),
    CASE WHEN LOWER(NEW.email) = 'zrezvi@gmail.com' THEN 'admin' ELSE 'user' END,
    CASE WHEN LOWER(NEW.email) = 'zrezvi@gmail.com' THEN 'approved' ELSE 'pending' END,
    CASE WHEN LOWER(NEW.email) = 'zrezvi@gmail.com' THEN now() ELSE null END
  )
  ON CONFLICT (id) DO UPDATE SET
    role = CASE WHEN LOWER(NEW.email) = 'zrezvi@gmail.com' THEN 'admin' ELSE EXCLUDED.role END,
    status = CASE WHEN LOWER(NEW.email) = 'zrezvi@gmail.com' THEN 'approved' ELSE EXCLUDED.status END,
    approved_at = CASE WHEN LOWER(NEW.email) = 'zrezvi@gmail.com' THEN now() ELSE EXCLUDED.approved_at END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Repair RPC for frontend fallback
CREATE OR REPLACE FUNCTION public.repair_owner_account()
RETURNS void AS $$
BEGIN
  UPDATE public.user_profiles
  SET role = 'admin', status = 'approved', approved_at = COALESCE(approved_at, now())
  WHERE id = auth.uid() AND LOWER(email) = 'zrezvi@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- One-time fix for existing stuck owner account
UPDATE public.user_profiles
SET role = 'admin', status = 'approved', approved_at = COALESCE(approved_at, now())
WHERE LOWER(email) = 'zrezvi@gmail.com';

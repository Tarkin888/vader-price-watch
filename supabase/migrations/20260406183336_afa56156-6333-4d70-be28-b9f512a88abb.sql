
-- User profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  rejected_at timestamptz,
  rejection_reason text,
  last_sign_in_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin can read all profiles"
  ON public.user_profiles FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin' AND up.status = 'approved'
    )
  );

CREATE POLICY "Admin can update all profiles"
  ON public.user_profiles FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin' AND up.status = 'approved'
    )
  );

CREATE POLICY "Service role full access to user_profiles"
  ON public.user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow insert for new users"
  ON public.user_profiles FOR INSERT WITH CHECK (true);

-- Trigger function: auto-create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, avatar_url, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', null),
    CASE WHEN NEW.email = 'zrezvi@gmail.com' THEN 'admin' ELSE 'user' END,
    CASE WHEN NEW.email = 'zrezvi@gmail.com' THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed owner account if they already exist
INSERT INTO public.user_profiles (id, email, display_name, role, status, approved_at)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Zia'), 'admin', 'approved', now()
FROM auth.users
WHERE email = 'zrezvi@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', status = 'approved', approved_at = now();

-- Update RLS: lots - replace public read with approved-user read
DROP POLICY IF EXISTS "Allow public read" ON public.lots;
CREATE POLICY "Approved users can read lots"
  ON public.lots FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND status = 'approved')
  );

-- Update RLS: knowledge_articles - replace public read with approved-user read
DROP POLICY IF EXISTS "Published articles are viewable by everyone" ON public.knowledge_articles;
CREATE POLICY "Approved users can read knowledge_articles"
  ON public.knowledge_articles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND status = 'approved')
  );

-- Update RLS: collection - replace public read with approved-user read + add write policies
DROP POLICY IF EXISTS "Allow public read" ON public.collection;
CREATE POLICY "Approved users can read collection"
  ON public.collection FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "Approved users can insert collection"
  ON public.collection FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "Approved users can update collection"
  ON public.collection FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND status = 'approved')
  );

-- Gallery storage: allow approved users to upload
CREATE POLICY "Approved users can upload to gallery"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'gallery'
    AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND status = 'approved')
  );

-- Enable realtime for user_profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;

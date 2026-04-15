
-- Create user_bug_reports table
CREATE TABLE public.user_bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  page_or_feature text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low','Medium','High','Critical')),
  screenshot_url text,
  status text NOT NULL DEFAULT 'New' CHECK (status IN ('New','In Progress','Dismissed','Resolved')),
  admin_notes text
);

ALTER TABLE public.user_bug_reports ENABLE ROW LEVEL SECURITY;

-- INSERT: authed user can insert their own
CREATE POLICY "Users can insert own bug reports"
  ON public.user_bug_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- SELECT: user reads own OR admin reads all
CREATE POLICY "Users can read own bug reports"
  ON public.user_bug_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- UPDATE: admin only
CREATE POLICY "Admins can update bug reports"
  ON public.user_bug_reports FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- DELETE: admin only
CREATE POLICY "Admins can delete bug reports"
  ON public.user_bug_reports FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Service role full access
CREATE POLICY "Service role full access to user_bug_reports"
  ON public.user_bug_reports FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('bug-screenshots', 'bug-screenshots', true, 5242880);

-- Public read for bug screenshots
CREATE POLICY "Public read bug screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bug-screenshots');

-- Authenticated users can upload screenshots
CREATE POLICY "Authenticated users can upload bug screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bug-screenshots');

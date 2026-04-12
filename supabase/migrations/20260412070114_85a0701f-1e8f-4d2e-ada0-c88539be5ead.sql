
-- Create changelog table
CREATE TABLE public.changelog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version text NOT NULL,
  release_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Feature',
  description text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "changelog_read_authenticated"
ON public.changelog FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert
CREATE POLICY "changelog_insert_admin"
ON public.changelog FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- Only admins can update
CREATE POLICY "changelog_update_admin"
ON public.changelog FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Only admins can delete
CREATE POLICY "changelog_delete_admin"
ON public.changelog FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Service role full access
CREATE POLICY "changelog_service_role"
ON public.changelog FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

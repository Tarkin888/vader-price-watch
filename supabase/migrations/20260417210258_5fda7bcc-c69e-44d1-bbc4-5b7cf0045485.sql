-- Admin can read all activity rows (regular user policy stays in place)
CREATE POLICY "Admins can read all activity"
ON public.user_activity
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Indexes to speed up analytics aggregations
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at
  ON public.user_activity (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_created
  ON public.user_activity (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_event_type
  ON public.user_activity (event_type);

-- Create user_activity table
CREATE TABLE public.user_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  entity_ref TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own activity"
ON public.user_activity
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity"
ON public.user_activity
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access"
ON public.user_activity
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Index for fast per-user queries sorted by time
CREATE INDEX idx_user_activity_user_created ON public.user_activity (user_id, created_at DESC);

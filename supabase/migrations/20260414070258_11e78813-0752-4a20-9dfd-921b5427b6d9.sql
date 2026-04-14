ALTER TABLE public.chatbot_feedback
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolution_notes text DEFAULT NULL;
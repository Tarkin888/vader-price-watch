ALTER TABLE public.user_notes ADD COLUMN IF NOT EXISTS source_context jsonb;
CREATE INDEX IF NOT EXISTS idx_user_notes_source_context_source ON public.user_notes ((source_context->>'source'));
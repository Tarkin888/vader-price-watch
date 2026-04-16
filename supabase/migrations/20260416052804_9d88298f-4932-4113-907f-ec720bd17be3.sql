
-- Create user_notes table
CREATE TABLE public.user_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  body TEXT NOT NULL CHECK (char_length(body) <= 10000),
  tags TEXT[],
  linked_lot_ref TEXT,
  linked_lot_source TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own notes"
ON public.user_notes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
ON public.user_notes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
ON public.user_notes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
ON public.user_notes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on user_notes"
ON public.user_notes FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Index for efficient sorted queries
CREATE INDEX idx_user_notes_list ON public.user_notes (user_id, pinned DESC, updated_at DESC);

-- Trigger: auto-update updated_at on UPDATE
CREATE TRIGGER update_user_notes_updated_at
BEFORE UPDATE ON public.user_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger function: enforce 100-entry cap per user
CREATE OR REPLACE FUNCTION public.enforce_notepad_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT count(*) INTO current_count
  FROM public.user_notes
  WHERE user_id = NEW.user_id;

  IF current_count >= 100 THEN
    RAISE EXCEPTION 'Notepad full — delete an entry before adding a new one (limit: 100).';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach the cap trigger to INSERT
CREATE TRIGGER enforce_notepad_limit_trigger
BEFORE INSERT ON public.user_notes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_notepad_limit();

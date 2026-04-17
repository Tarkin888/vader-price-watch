-- Extend collection table with auction-style variant identity columns
ALTER TABLE public.collection
  ADD COLUMN IF NOT EXISTS era text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS cardback_code text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS variant_code text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS grade_tier_code text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS variant_grade_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lot_ref text,
  ADD COLUMN IF NOT EXISTS lot_url text,
  ADD COLUMN IF NOT EXISTS character text NOT NULL DEFAULT 'VADER',
  ADD COLUMN IF NOT EXISTS figure_id text NOT NULL DEFAULT 'VADER';

-- Trigger to keep variant_grade_key in sync (text-typed twin of the lots-table function)
CREATE OR REPLACE FUNCTION public.compute_collection_variant_grade_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.variant_grade_key := COALESCE(NEW.variant_code, '') || '-' || COALESCE(NEW.grade_tier_code, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collection_variant_grade_key ON public.collection;
CREATE TRIGGER trg_collection_variant_grade_key
BEFORE INSERT OR UPDATE OF variant_code, grade_tier_code ON public.collection
FOR EACH ROW
EXECUTE FUNCTION public.compute_collection_variant_grade_key();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collection_user_cardback
  ON public.collection (user_id, cardback_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_user_lotref_source_unique
  ON public.collection (user_id, lot_ref, purchase_source)
  WHERE lot_ref IS NOT NULL AND lot_ref <> '';
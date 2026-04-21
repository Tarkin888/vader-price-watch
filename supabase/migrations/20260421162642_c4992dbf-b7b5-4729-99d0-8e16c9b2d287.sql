-- Suspected Duplicates: ignore list + merge audit log

CREATE TABLE public.duplicate_ignore_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id_a UUID NOT NULL,
  lot_id_b UUID NOT NULL,
  marked_distinct_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  marked_by TEXT,
  CONSTRAINT duplicate_ignore_list_distinct_ids CHECK (lot_id_a <> lot_id_b)
);

-- Unique unordered pair: index on (LEAST, GREATEST) so (A,B) and (B,A) collide
CREATE UNIQUE INDEX duplicate_ignore_list_pair_uniq
  ON public.duplicate_ignore_list (LEAST(lot_id_a, lot_id_b), GREATEST(lot_id_a, lot_id_b));

ALTER TABLE public.duplicate_ignore_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "duplicate_ignore_list_service_role"
  ON public.duplicate_ignore_list FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "duplicate_ignore_list_read_admin"
  ON public.duplicate_ignore_list FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));


CREATE TABLE public.duplicate_merge_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kept_lot_id UUID NOT NULL,
  deleted_lot_id UUID NOT NULL,
  merged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  merged_by TEXT,
  kept_lot_ref TEXT,
  deleted_lot_ref TEXT,
  source TEXT
);

CREATE INDEX duplicate_merge_log_merged_at_idx
  ON public.duplicate_merge_log (merged_at DESC);

ALTER TABLE public.duplicate_merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "duplicate_merge_log_service_role"
  ON public.duplicate_merge_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "duplicate_merge_log_read_admin"
  ON public.duplicate_merge_log FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
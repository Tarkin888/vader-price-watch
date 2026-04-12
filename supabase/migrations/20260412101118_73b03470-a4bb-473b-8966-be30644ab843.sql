
CREATE TABLE public.scrape_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'SUCCESS',
  phase1_anchors integer NOT NULL DEFAULT 0,
  phase1_walks integer NOT NULL DEFAULT 0,
  lots_visited integer NOT NULL DEFAULT 0,
  moc_passed integer NOT NULL DEFAULT 0,
  new_inserted integer NOT NULL DEFAULT 0,
  duplicates_skipped integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  error_summary text,
  scraper_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scrape_sessions ENABLE ROW LEVEL SECURITY;

-- Admin can read sessions
CREATE POLICY "scrape_sessions_read_admin"
  ON public.scrape_sessions FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Service role full access
CREATE POLICY "scrape_sessions_write_service_role"
  ON public.scrape_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

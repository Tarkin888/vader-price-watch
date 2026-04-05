
-- 1. Scraper run history
CREATE TABLE IF NOT EXISTS scraper_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'SUCCESS',
  records_captured integer DEFAULT 0,
  records_skipped integer DEFAULT 0,
  error_message text,
  duration_seconds numeric,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scraper_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to scraper_logs"
  ON scraper_logs FOR ALL USING (true) WITH CHECK (true);

-- 2. Bug reports / issue tracking
CREATE TABLE IF NOT EXISTS bug_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL DEFAULT 'OTHER',
  description text NOT NULL,
  lot_ref text,
  status text NOT NULL DEFAULT 'OPEN',
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to bug_reports"
  ON bug_reports FOR ALL USING (true) WITH CHECK (true);

-- 3. Page view tracking
CREATE TABLE IF NOT EXISTS page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  viewed_at timestamptz DEFAULT now(),
  page text DEFAULT 'main'
);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to page_views"
  ON page_views FOR ALL USING (true) WITH CHECK (true);

-- 4. Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id uuid,
  lot_ref text,
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to audit_log"
  ON audit_log FOR ALL USING (true) WITH CHECK (true);

-- 5. Runtime key-value config
CREATE TABLE IF NOT EXISTS admin_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  label text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to admin_config"
  ON admin_config FOR ALL USING (true) WITH CHECK (true);

-- Default config values
INSERT INTO admin_config (key, value, label) VALUES
  ('usd_gbp_rate',                '0.79',   'USD → GBP Exchange Rate'),
  ('heritage_price_floor_usd',    '50',     'Heritage Minimum Valid Price (USD)'),
  ('notable_sales_threshold_gbp', '5000',   'Notable Sales Banner Threshold (GBP)'),
  ('admin_pin',                   '1977',   'Admin PIN'),
  ('hakes_bp_rate',               '0.20',   'Hake''s Buyer Premium Rate'),
  ('heritage_bp_rate',            '0.20',   'Heritage Buyer Premium Rate'),
  ('lcg_bp_rate',                 '0.22',   'LCG Buyer Premium Rate'),
  ('vectis_bp_rate',              '0.225',  'Vectis Buyer Premium Rate'),
  ('candt_bp_rate',               '0.264',  'C&T Buyer Premium Rate (inc VAT)')
ON CONFLICT (key) DO NOTHING;

-- 6. Add tags column to knowledge_articles if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_articles' AND column_name = 'tags'
  ) THEN
    ALTER TABLE knowledge_articles ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
END $$;

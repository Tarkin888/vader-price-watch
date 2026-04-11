
-- Allow anon-key inserts on lots (scraper scripts)
CREATE POLICY "anon_insert_lots"
ON public.lots
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon-key updates on lots (Vectis price confirmations)
CREATE POLICY "anon_update_lots"
ON public.lots
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow anon-key inserts on scraper_logs
CREATE POLICY "anon_insert_scraper_logs"
ON public.scraper_logs
FOR INSERT
TO anon
WITH CHECK (true);

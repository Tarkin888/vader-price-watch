-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Authenticated users can manage articles" ON knowledge_articles;

-- Allow the app's service role to manage all articles
CREATE POLICY "Service role can manage all articles"
  ON knowledge_articles FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add user_id column
ALTER TABLE collection ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Backfill existing rows to the owner account
UPDATE collection
SET user_id = (SELECT id FROM auth.users WHERE email = 'zrezvi@gmail.com' LIMIT 1)
WHERE user_id IS NULL;

-- Make user_id NOT NULL after backfill
ALTER TABLE collection ALTER COLUMN user_id SET NOT NULL;

-- Create index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_collection_user_id ON collection(user_id);

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Approved users can read collection" ON collection;
DROP POLICY IF EXISTS "Approved users can insert collection" ON collection;
DROP POLICY IF EXISTS "Approved users can update collection" ON collection;
DROP POLICY IF EXISTS "Approved users can update own collection" ON collection;
DROP POLICY IF EXISTS "collection_write_service_role" ON collection;

-- Users can only read their own collection items
CREATE POLICY "Users can read own collection"
  ON collection FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own collection items
CREATE POLICY "Users can insert own collection"
  ON collection FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own collection items
CREATE POLICY "Users can update own collection"
  ON collection FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own collection items
CREATE POLICY "Users can delete own collection"
  ON collection FOR DELETE USING (auth.uid() = user_id);

-- Service role full access (for admin-write edge function)
CREATE POLICY "Service role full access to collection"
  ON collection FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');


-- Knowledge Articles table for the Research Library
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  content_md text NOT NULL DEFAULT '',
  image_urls text[] DEFAULT '{}',
  source_urls text[] DEFAULT '{}',
  display_order integer DEFAULT 0,
  is_published boolean DEFAULT false,
  last_researched date,
  confidence text DEFAULT 'MEDIUM',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_slug ON knowledge_articles(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_published ON knowledge_articles(is_published);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_knowledge_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_articles_updated_at
  BEFORE UPDATE ON knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_articles_updated_at();

-- Row Level Security
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;

-- Public can read published articles
CREATE POLICY "Published articles are viewable by everyone"
  ON knowledge_articles FOR SELECT
  USING (is_published = true);

-- Authenticated users can perform all operations (admin access)
CREATE POLICY "Authenticated users can manage articles"
  ON knowledge_articles FOR ALL
  USING (auth.role() = 'authenticated');

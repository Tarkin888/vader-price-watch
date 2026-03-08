
-- Create enums for collection
CREATE TYPE public.collection_category AS ENUM (
  '12 BACK', '20 BACK', '21 BACK', 'ESB', 'ROTJ', 'SECRET OFFER', 'FETT STICKER', 'TRILOGO', 'OTHER'
);

CREATE TYPE public.collection_grading AS ENUM (
  'Not Graded', 'AFA 75', 'AFA 80', 'AFA 85', 'AFA 90+', 'UKG 80', 'UKG 85', 'CAS 80', 'CAS 85'
);

-- Create collection table
CREATE TABLE public.collection (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  category public.collection_category NOT NULL,
  grading public.collection_grading NOT NULL DEFAULT 'Not Graded',
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL,
  purchase_source TEXT NOT NULL DEFAULT '',
  current_estimated_value NUMERIC,
  notes TEXT NOT NULL DEFAULT '',
  image_urls TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collection ENABLE ROW LEVEL SECURITY;

-- Public access policies (matching lots table pattern)
CREATE POLICY "Allow public read" ON public.collection FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.collection FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.collection FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.collection FOR DELETE USING (true);

-- Updated_at trigger
CREATE TRIGGER update_collection_updated_at
  BEFORE UPDATE ON public.collection
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

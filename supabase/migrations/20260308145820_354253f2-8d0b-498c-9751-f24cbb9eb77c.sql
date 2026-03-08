CREATE TYPE public.lot_source AS ENUM ('Heritage', 'Hakes', 'Vectis', 'LCG');
CREATE TYPE public.variant_code AS ENUM ('12A', '12B', '12C', '12A-DT', '12B-DT', 'CAN', 'PAL');
CREATE TYPE public.grade_tier_code AS ENUM ('RAW-NM', 'RAW-EX', 'RAW-VG', 'AFA-70', 'AFA-75', 'AFA-80', 'AFA-85', 'AFA-90+', 'UKG-80', 'UKG-85', 'CAS-80');

CREATE TABLE public.lots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capture_date DATE NOT NULL,
  sale_date DATE NOT NULL,
  source lot_source NOT NULL,
  lot_ref TEXT NOT NULL DEFAULT '',
  lot_url TEXT NOT NULL DEFAULT '',
  variant_code variant_code NOT NULL,
  grade_tier_code grade_tier_code NOT NULL,
  variant_grade_key TEXT NOT NULL DEFAULT '',
  hammer_price_gbp NUMERIC(12,2) NOT NULL DEFAULT 0,
  buyers_premium_gbp NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_paid_gbp NUMERIC(12,2) NOT NULL DEFAULT 0,
  usd_to_gbp_rate NUMERIC(10,6) NOT NULL DEFAULT 1,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  condition_notes TEXT NOT NULL DEFAULT '',
  grade_subgrades TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.compute_variant_grade_key()
RETURNS TRIGGER AS $$
BEGIN
  NEW.variant_grade_key := NEW.variant_code::text || '-' || NEW.grade_tier_code::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_variant_grade_key
  BEFORE INSERT OR UPDATE ON public.lots
  FOR EACH ROW EXECUTE FUNCTION public.compute_variant_grade_key();

ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.lots FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.lots FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.lots FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.lots FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_lots_updated_at
  BEFORE UPDATE ON public.lots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
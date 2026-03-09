
ALTER TABLE public.lots
ADD COLUMN IF NOT EXISTS estimate_low_gbp numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS estimate_high_gbp numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_status text NOT NULL DEFAULT 'SOLD';

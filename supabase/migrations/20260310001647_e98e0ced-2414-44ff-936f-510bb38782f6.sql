ALTER TABLE public.lots ALTER COLUMN hammer_price_gbp DROP NOT NULL;
ALTER TABLE public.lots ALTER COLUMN buyers_premium_gbp DROP NOT NULL;
ALTER TABLE public.lots ALTER COLUMN total_paid_gbp DROP NOT NULL;
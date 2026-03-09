
ALTER TABLE public.lots 
ALTER COLUMN price_status SET DEFAULT 'CONFIRMED';

UPDATE public.lots SET price_status = 'CONFIRMED' WHERE price_status = 'SOLD';


-- Add new variant codes
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'MEX';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'VP';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'SW-12';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'SW-12A';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'SW-12A-DT';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'SW-12B';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'SW-12B-DT';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'SW-12C';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'SW-20';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'SW-21';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'ESB-31';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'ESB-32';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'ESB-41';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'ESB-45';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'ESB-47';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'ESB-48';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'ROTJ-48';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'ROTJ-65';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'ROTJ-65-VP';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'ROTJ-77';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'ROTJ-79';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'POTF-92';
ALTER TYPE public.variant_code ADD VALUE IF NOT EXISTS 'UNKNOWN';

-- Add UNKNOWN grade tier
ALTER TYPE public.grade_tier_code ADD VALUE IF NOT EXISTS 'UNKNOWN';


-- Create era enum
CREATE TYPE public.lot_era AS ENUM ('SW', 'ESB', 'ROTJ', 'POTF', 'UNKNOWN');

-- Add era and cardback_code columns
ALTER TABLE public.lots
  ADD COLUMN era public.lot_era NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN cardback_code text NOT NULL DEFAULT 'UNKNOWN';

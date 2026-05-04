
-- Security-definer view so anon can check for duplicates without accessing full lots table
CREATE VIEW public.lots_dedupe_index
WITH (security_invoker = false)
AS SELECT source, lot_ref FROM public.lots;

-- Grant anon SELECT on the view only
GRANT SELECT ON public.lots_dedupe_index TO anon;

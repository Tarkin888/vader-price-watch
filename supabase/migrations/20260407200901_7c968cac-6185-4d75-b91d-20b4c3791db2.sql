
-- Remove user_profiles from realtime publication (no IF EXISTS for ALTER PUBLICATION)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.user_profiles;
  END IF;
END $$;

-- Remove public insert on gallery storage bucket
DROP POLICY IF EXISTS "Gallery public insert" ON storage.objects;

-- Remove public delete on gallery storage bucket  
DROP POLICY IF EXISTS "Gallery public delete" ON storage.objects;

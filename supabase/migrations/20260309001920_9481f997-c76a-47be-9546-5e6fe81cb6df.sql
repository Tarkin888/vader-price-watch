
-- Create public gallery storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('gallery', 'gallery', true, 20971520)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for gallery bucket
CREATE POLICY "Gallery public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'gallery');

CREATE POLICY "Gallery public insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gallery');

CREATE POLICY "Gallery public delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'gallery');

-- Add cached_image_url column to lots
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS cached_image_url text DEFAULT NULL;

-- Create public storage bucket for lot images
INSERT INTO storage.buckets (id, name, public)
VALUES ('lot-images', 'lot-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "lot_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'lot-images');

-- Service role write access
CREATE POLICY "lot_images_service_write"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'lot-images');

CREATE POLICY "lot_images_service_update"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'lot-images');

CREATE POLICY "lot_images_service_delete"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'lot-images');
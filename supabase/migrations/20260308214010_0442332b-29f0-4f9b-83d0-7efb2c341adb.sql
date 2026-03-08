ALTER TABLE public.collection ADD COLUMN IF NOT EXISTS front_image_url text DEFAULT '';
ALTER TABLE public.collection ADD COLUMN IF NOT EXISTS back_image_url text DEFAULT '';
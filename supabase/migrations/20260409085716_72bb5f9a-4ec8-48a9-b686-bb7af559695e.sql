-- Fix 1: Restrict chatbot_feedback SELECT to admins only
DROP POLICY IF EXISTS "auth_select_chatbot_feedback" ON public.chatbot_feedback;
CREATE POLICY "chatbot_feedback_read_admin"
ON public.chatbot_feedback
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Fix 2: Scope gallery uploads to user's own folder
DROP POLICY IF EXISTS "Approved users can upload to gallery" ON storage.objects;
CREATE POLICY "Approved users can upload to own gallery folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gallery'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);
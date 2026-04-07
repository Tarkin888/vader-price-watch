
-- =============================================
-- 1. page_views: restrict SELECT to admin, INSERT to authenticated
-- =============================================
DROP POLICY IF EXISTS "page_views_read_public" ON public.page_views;
DROP POLICY IF EXISTS "page_views_insert_public" ON public.page_views;
DROP POLICY IF EXISTS "page_views_read_admin" ON public.page_views;

CREATE POLICY "page_views_read_admin" ON public.page_views
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "page_views_insert_authenticated" ON public.page_views
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================
-- 2. chat_messages: restrict to authenticated
-- =============================================
DROP POLICY IF EXISTS "anon_select_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "anon_insert_chat_messages" ON public.chat_messages;

CREATE POLICY "auth_select_chat_messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_insert_chat_messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================
-- 3. chat_sessions: restrict to authenticated
-- =============================================
DROP POLICY IF EXISTS "anon_select_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "anon_insert_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "anon_update_chat_sessions" ON public.chat_sessions;

CREATE POLICY "auth_select_chat_sessions" ON public.chat_sessions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_insert_chat_sessions" ON public.chat_sessions
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_chat_sessions" ON public.chat_sessions
  FOR UPDATE TO authenticated
  USING (true);

-- =============================================
-- 4. chatbot_feedback: restrict to authenticated
-- =============================================
DROP POLICY IF EXISTS "anon_select_chatbot_feedback" ON public.chatbot_feedback;
DROP POLICY IF EXISTS "anon_insert_chatbot_feedback" ON public.chatbot_feedback;

CREATE POLICY "auth_select_chatbot_feedback" ON public.chatbot_feedback
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_insert_chatbot_feedback" ON public.chatbot_feedback
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================
-- 5. collection: drop misleading service_role policy
-- =============================================
DROP POLICY IF EXISTS "Service role full access to collection" ON public.collection;

-- =============================================
-- 6. bug_reports: restrict SELECT to authenticated
-- =============================================
DROP POLICY IF EXISTS "bug_reports_read_public" ON public.bug_reports;

CREATE POLICY "bug_reports_read_authenticated" ON public.bug_reports
  FOR SELECT TO authenticated
  USING (true);

-- =============================================
-- 7. Fix handle_new_user search_path (function_search_path_mutable)
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, avatar_url, role, status, approved_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', null),
    CASE WHEN LOWER(NEW.email) = 'zrezvi@gmail.com' THEN 'admin' ELSE 'user' END,
    CASE WHEN LOWER(NEW.email) = 'zrezvi@gmail.com' THEN 'approved' ELSE 'pending' END,
    CASE WHEN LOWER(NEW.email) = 'zrezvi@gmail.com' THEN now() ELSE null END
  )
  ON CONFLICT (id) DO UPDATE SET
    role = CASE WHEN LOWER(NEW.email) = 'zrezvi@gmail.com' THEN 'admin' ELSE EXCLUDED.role END,
    status = CASE WHEN LOWER(NEW.email) = 'zrezvi@gmail.com' THEN 'approved' ELSE EXCLUDED.status END,
    approved_at = CASE WHEN LOWER(NEW.email) = 'zrezvi@gmail.com' THEN now() ELSE EXCLUDED.approved_at END;
  RETURN NEW;
END;
$function$;

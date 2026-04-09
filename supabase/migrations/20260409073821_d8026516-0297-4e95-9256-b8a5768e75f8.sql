
-- Add user_id to chat_sessions
ALTER TABLE public.chat_sessions ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill existing sessions with NULL user_id (they'll be inaccessible until claimed, which is fine for security)

-- Drop old open SELECT policies on chat_sessions and chat_messages
DROP POLICY IF EXISTS "auth_select_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "auth_insert_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "auth_update_chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "auth_select_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "auth_insert_chat_messages" ON public.chat_messages;

-- chat_sessions: users can only see their own sessions
CREATE POLICY "Users can read own chat sessions"
ON public.chat_sessions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- chat_sessions: users can only create sessions they own
CREATE POLICY "Users can create own chat sessions"
ON public.chat_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- chat_sessions: users can only update their own sessions
CREATE POLICY "Users can update own chat sessions"
ON public.chat_sessions FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- chat_messages: users can only read messages in their own sessions
CREATE POLICY "Users can read own chat messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.chat_sessions
  WHERE chat_sessions.id = chat_messages.session_id
    AND chat_sessions.user_id = auth.uid()
));

-- chat_messages: users can only insert messages into their own sessions
CREATE POLICY "Users can insert own chat messages"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.chat_sessions
  WHERE chat_sessions.id = chat_messages.session_id
    AND chat_sessions.user_id = auth.uid()
));

-- Bug reports: restrict reads to admins only
DROP POLICY IF EXISTS "bug_reports_read_authenticated" ON public.bug_reports;

CREATE POLICY "bug_reports_read_admin"
ON public.bug_reports FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));


-- Table: chat_sessions
CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  session_type text NOT NULL DEFAULT 'GENERAL',
  status text NOT NULL DEFAULT 'ACTIVE',
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_chat_sessions" ON public.chat_sessions FOR SELECT USING (true);
CREATE POLICY "anon_insert_chat_sessions" ON public.chat_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_chat_sessions" ON public.chat_sessions FOR UPDATE USING (true);

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: chat_messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  role text NOT NULL,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'TEXT',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_chat_messages" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "anon_insert_chat_messages" ON public.chat_messages FOR INSERT WITH CHECK (true);

CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);

-- Table: chatbot_feedback
CREATE TABLE public.chatbot_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.chat_sessions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  feedback_type text NOT NULL,
  category text,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  priority text NOT NULL DEFAULT 'MEDIUM',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.chatbot_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_chatbot_feedback" ON public.chatbot_feedback FOR SELECT USING (true);
CREATE POLICY "anon_insert_chatbot_feedback" ON public.chatbot_feedback FOR INSERT WITH CHECK (true);

CREATE INDEX idx_chatbot_feedback_status ON public.chatbot_feedback(status);
CREATE INDEX idx_chatbot_feedback_feedback_type ON public.chatbot_feedback(feedback_type);

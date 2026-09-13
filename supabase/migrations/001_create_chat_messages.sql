-- Chat feature: create chat_messages table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id TEXT,
  receiver_id TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "chat_select" ON public.chat_messages
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "chat_insert" ON public.chat_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "chat_delete" ON public.chat_messages
  FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_chat_receiver ON public.chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON public.chat_messages(sender_id);

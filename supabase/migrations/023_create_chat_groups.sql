-- Group chats: a group of friends, an invite link anyone can join with, and
-- text, photo, video and file messages in one thread.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

CREATE TABLE IF NOT EXISTS public.chat_groups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_group_members (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_group_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  sender_id TEXT,
  message TEXT,
  attachment_url TEXT,
  attachment_type TEXT,   -- image | video | file
  attachment_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_groups_select" ON public.chat_groups;
CREATE POLICY "chat_groups_select" ON public.chat_groups
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "chat_groups_insert" ON public.chat_groups;
CREATE POLICY "chat_groups_insert" ON public.chat_groups
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "chat_groups_update" ON public.chat_groups;
CREATE POLICY "chat_groups_update" ON public.chat_groups
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "chat_group_members_select" ON public.chat_group_members;
CREATE POLICY "chat_group_members_select" ON public.chat_group_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "chat_group_members_insert" ON public.chat_group_members;
CREATE POLICY "chat_group_members_insert" ON public.chat_group_members
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "chat_group_members_delete" ON public.chat_group_members;
CREATE POLICY "chat_group_members_delete" ON public.chat_group_members
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "chat_group_messages_select" ON public.chat_group_messages;
CREATE POLICY "chat_group_messages_select" ON public.chat_group_messages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "chat_group_messages_insert" ON public.chat_group_messages;
CREATE POLICY "chat_group_messages_insert" ON public.chat_group_messages
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "chat_group_messages_delete" ON public.chat_group_messages;
CREATE POLICY "chat_group_messages_delete" ON public.chat_group_messages
  FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_chat_group_members_user ON public.chat_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_group ON public.chat_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_messages_group ON public.chat_group_messages(group_id, created_at);

-- Group chat: replies to a specific message, a pinned message per group, and
-- group admins (the creator starts as the first admin). @everyone needs no column.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE public.chat_group_messages
  ADD COLUMN IF NOT EXISTS reply_to_id BIGINT REFERENCES public.chat_group_messages(id) ON DELETE SET NULL;

ALTER TABLE public.chat_groups
  ADD COLUMN IF NOT EXISTS pinned_message_id BIGINT REFERENCES public.chat_group_messages(id) ON DELETE SET NULL;

ALTER TABLE public.chat_group_members
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Whoever created the group is its first admin
UPDATE public.chat_group_members m
SET is_admin = true
FROM public.chat_groups g
WHERE m.group_id = g.id
  AND m.user_id = g.created_by
  AND m.is_admin = false;

-- Admins promote other members, so membership rows can be updated
DROP POLICY IF EXISTS "chat_group_members_update" ON public.chat_group_members;
CREATE POLICY "chat_group_members_update" ON public.chat_group_members
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_group_messages_reply ON public.chat_group_messages(reply_to_id);

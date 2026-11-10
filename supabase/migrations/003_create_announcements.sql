-- Feed posts: status updates and announcements shown on the home feed and profile
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

CREATE TABLE IF NOT EXISTS public.announcements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT,
  content TEXT,
  priority TEXT DEFAULT 'normal',
  is_active BOOLEAN DEFAULT true,
  "date" DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
CREATE POLICY "announcements_select" ON public.announcements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "announcements_insert" ON public.announcements;
CREATE POLICY "announcements_insert" ON public.announcements
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements(created_at DESC);

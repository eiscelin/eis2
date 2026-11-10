-- My Day stories: a member adds a photo, everyone sees it on the home feed for 24 hours
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

CREATE TABLE IF NOT EXISTS public.stories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT,
  author_name TEXT,
  image TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories_select" ON public.stories;
CREATE POLICY "stories_select" ON public.stories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "stories_insert" ON public.stories;
CREATE POLICY "stories_insert" ON public.stories
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_stories_created ON public.stories(created_at DESC);

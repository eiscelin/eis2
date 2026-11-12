-- Reactions a member uploaded themselves (a face photo or a video up to 5 seconds).
-- Keeping them in the database is what lets an admin see who owns each reaction.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

CREATE TABLE IF NOT EXISTS public.reaction_media (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'face',        -- face | video
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reaction_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reaction_media_select" ON public.reaction_media;
CREATE POLICY "reaction_media_select" ON public.reaction_media FOR SELECT USING (true);
DROP POLICY IF EXISTS "reaction_media_insert" ON public.reaction_media;
CREATE POLICY "reaction_media_insert" ON public.reaction_media FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "reaction_media_delete" ON public.reaction_media;
CREATE POLICY "reaction_media_delete" ON public.reaction_media FOR DELETE USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reaction_media_once
  ON public.reaction_media (user_id, url);
CREATE INDEX IF NOT EXISTS idx_reaction_media_user ON public.reaction_media(user_id);

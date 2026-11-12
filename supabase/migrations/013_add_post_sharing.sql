-- Sharing: a shared post keeps a link to the original plus who may see it
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'public';  -- public | friends | only_me
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS shared_post_id BIGINT;           -- the post being shared

CREATE INDEX IF NOT EXISTS idx_posts_shared ON public.posts(shared_post_id);

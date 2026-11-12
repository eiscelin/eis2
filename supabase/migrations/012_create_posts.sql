-- Member posts: text with an optional photo or video, Facebook-style reactions and comments
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- ===== Posts =====
CREATE TABLE IF NOT EXISTS public.posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT,
  author_name TEXT,
  author_username TEXT,
  content TEXT,
  media_url TEXT,
  media_type TEXT,                          -- image | video
  share_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select" ON public.posts;
CREATE POLICY "posts_select" ON public.posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "posts_insert" ON public.posts;
CREATE POLICY "posts_insert" ON public.posts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "posts_update" ON public.posts;
CREATE POLICY "posts_update" ON public.posts FOR UPDATE USING (true);
DROP POLICY IF EXISTS "posts_delete" ON public.posts;
CREATE POLICY "posts_delete" ON public.posts FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON public.posts(user_id);

-- ===== One reaction per member per post =====
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  user_name TEXT,
  type TEXT NOT NULL DEFAULT 'like',        -- like | love | haha | wow | sad | angry
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_reactions_select" ON public.post_reactions;
CREATE POLICY "post_reactions_select" ON public.post_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "post_reactions_insert" ON public.post_reactions;
CREATE POLICY "post_reactions_insert" ON public.post_reactions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "post_reactions_update" ON public.post_reactions;
CREATE POLICY "post_reactions_update" ON public.post_reactions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "post_reactions_delete" ON public.post_reactions;
CREATE POLICY "post_reactions_delete" ON public.post_reactions FOR DELETE USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_reactions_one
  ON public.post_reactions (post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON public.post_reactions(post_id);

-- ===== Comments =====
CREATE TABLE IF NOT EXISTS public.post_comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  user_name TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  edited_at TIMESTAMPTZ
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comments_select" ON public.post_comments;
CREATE POLICY "post_comments_select" ON public.post_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "post_comments_insert" ON public.post_comments;
CREATE POLICY "post_comments_insert" ON public.post_comments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "post_comments_update" ON public.post_comments;
CREATE POLICY "post_comments_update" ON public.post_comments FOR UPDATE USING (true);
DROP POLICY IF EXISTS "post_comments_delete" ON public.post_comments;
CREATE POLICY "post_comments_delete" ON public.post_comments FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id, created_at);

-- ===== One reaction per member per comment =====
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  comment_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  user_name TEXT,
  type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_reactions_select" ON public.comment_reactions;
CREATE POLICY "comment_reactions_select" ON public.comment_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "comment_reactions_insert" ON public.comment_reactions;
CREATE POLICY "comment_reactions_insert" ON public.comment_reactions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "comment_reactions_update" ON public.comment_reactions;
CREATE POLICY "comment_reactions_update" ON public.comment_reactions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "comment_reactions_delete" ON public.comment_reactions;
CREATE POLICY "comment_reactions_delete" ON public.comment_reactions FOR DELETE USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_reactions_one
  ON public.comment_reactions (comment_id, user_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON public.comment_reactions(comment_id);

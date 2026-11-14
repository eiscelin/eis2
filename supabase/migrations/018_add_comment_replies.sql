-- ===== Replies to comments =====
-- A comment with parent_id set is a reply to that comment. Replies are shown
-- indented under their parent, and they are not part of the comment highlight
-- loop. Deleting a comment removes its replies with it.

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_id BIGINT
  REFERENCES public.post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON public.post_comments(parent_id);

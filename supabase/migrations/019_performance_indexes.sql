-- ===== Indexes for the queries the app repeats =====
-- Every list the app opens reads in a fixed order: the feed newest first, a
-- profile's own posts, a chat thread, the friend list. These indexes let
-- Postgres answer them from the index instead of scanning the whole table,
-- which is what makes a feed take seconds once a community grows.

-- Sign-in looks a member up by username on every log in
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- Home feed: newest posts overall. Profile: one member's posts, newest first.
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON public.posts(user_id, created_at DESC);

-- One reaction per member per post, read together with the post's reactions
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_user ON public.post_reactions(post_id, user_id);

-- A chat thread reads by who received it and when (the chat refreshes every
-- few seconds, so this is the most requested query in the app)
CREATE INDEX IF NOT EXISTS idx_chat_receiver_created ON public.chat_messages(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sender_created ON public.chat_messages(sender_id, created_at DESC);

-- The friend list is read when the feed opens its stories and its posts
CREATE INDEX IF NOT EXISTS idx_friend_requests_status_sender
  ON public.friend_requests(status, sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status_receiver
  ON public.friend_requests(status, receiver_id);

-- Replies to a member's own comments, shown in the notification bell
CREATE INDEX IF NOT EXISTS idx_post_comments_user_created
  ON public.post_comments(user_id, created_at DESC);

ANALYZE public.users;
ANALYZE public.posts;
ANALYZE public.post_comments;
ANALYZE public.post_reactions;
ANALYZE public.chat_messages;
ANALYZE public.friend_requests;

-- Admin content controls: remove any member's displayed content
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- ---------- Profile picture / cover ----------

CREATE OR REPLACE FUNCTION public.admin_delete_media(
  p_admin_id BIGINT,
  p_user_id BIGINT,
  p_kind TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_kind NOT IN ('avatar', 'cover') THEN
    RAISE EXCEPTION 'Unknown media kind';
  END IF;

  IF p_kind = 'avatar' THEN
    UPDATE public.users
       SET avatar_url = NULL,
           avatar_pending_url = NULL,
           avatar_review_status = 'none'
     WHERE id = p_user_id;
  ELSE
    UPDATE public.users
       SET cover_url = NULL,
           cover_pending_url = NULL,
           cover_review_status = 'none'
     WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_media(BIGINT, BIGINT, TEXT) TO anon, authenticated;

-- ---------- My Day stories ----------

CREATE OR REPLACE FUNCTION public.admin_delete_story(
  p_admin_id BIGINT,
  p_story_id BIGINT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  DELETE FROM public.stories WHERE id = p_story_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_story(BIGINT, BIGINT) TO anon, authenticated;

-- ---------- Housekeeping ----------

-- Removes the temporary accounts created while this app was being built
-- (any username starting with b44probe). Safe to run more than once.
DELETE FROM public.chat_messages
 WHERE sender_id IN (SELECT id::text FROM public.users WHERE username LIKE 'b44probe%')
    OR receiver_id IN (SELECT id::text FROM public.users WHERE username LIKE 'b44probe%');
DELETE FROM public.stories
 WHERE user_id IN (SELECT id FROM public.users WHERE username LIKE 'b44probe%');
DELETE FROM public.users WHERE username LIKE 'b44probe%';

-- Profile covers go live at once, without an admin review.
-- Profile pictures still follow the "Require profile media approval" setting.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- Covers already waiting for review become live straight away
UPDATE public.users
   SET cover_url = COALESCE(cover_pending_url, cover_url),
       cover_pending_url = NULL,
       cover_review_status = 'approved'
 WHERE cover_pending_url IS NOT NULL
    OR cover_review_status = 'pending';

CREATE OR REPLACE FUNCTION public.submit_profile_media(
  p_user_id BIGINT,
  p_kind TEXT,
  p_url TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval BOOLEAN;
BEGIN
  IF p_kind NOT IN ('avatar', 'cover') THEN
    RAISE EXCEPTION 'Unknown media kind';
  END IF;

  -- A cover is the member's own banner: it always applies immediately
  IF p_kind = 'cover' THEN
    UPDATE public.users
       SET cover_url = p_url, cover_pending_url = NULL, cover_review_status = 'approved'
     WHERE id = p_user_id;
    RETURN;
  END IF;

  SELECT COALESCE((SELECT value FROM public.app_settings WHERE key = 'require_media_approval'), 'true') = 'true'
    INTO v_approval;

  IF v_approval THEN
    UPDATE public.users
       SET avatar_pending_url = p_url, avatar_review_status = 'pending'
     WHERE id = p_user_id;
  ELSE
    UPDATE public.users
       SET avatar_url = p_url, avatar_pending_url = NULL, avatar_review_status = 'approved'
     WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_profile_media(BIGINT, TEXT, TEXT) TO anon, authenticated;

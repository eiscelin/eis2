-- Account background picture, shown behind every page for the signed-in member
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS background_url TEXT;

-- Writes go through this function for the same reason as set_profile_media: a
-- signed-in browser may change the background column only, never the password or role.
CREATE OR REPLACE FUNCTION public.set_page_background(
  p_user_id BIGINT,
  p_background_url TEXT
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users
     SET background_url = NULLIF(btrim(COALESCE(p_background_url, '')), '')
   WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.set_page_background(BIGINT, TEXT) TO anon, authenticated;
